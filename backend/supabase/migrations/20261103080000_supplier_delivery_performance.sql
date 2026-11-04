-- =============================================================================
-- SCM FLOW — SUPPLIER DELIVERY PERFORMANCE & ANALYTICS
-- File: backend/supabase/migrations/20261103080000_supplier_delivery_performance.sql
-- =============================================================================

BEGIN;

-- 1. Index Optimizations for Analytics & Scorecard Queries
CREATE INDEX IF NOT EXISTS idx_mdt_supplier_commitment 
ON public.material_delivery_tracking(supplier_id, original_committed_delivery_date);

CREATE INDEX IF NOT EXISTS idx_mdt_supplier_expected
ON public.material_delivery_tracking(supplier_id, current_expected_delivery_date);

CREATE INDEX IF NOT EXISTS idx_mdt_completion_date 
ON public.material_delivery_tracking(actual_completion_date);

CREATE INDEX IF NOT EXISTS idx_mdt_supplier_category
ON public.material_delivery_tracking(supplier_id, category);


-- 2. Seed Granular Permissions for Supplier Performance
INSERT INTO public.permissions (id, module, description) VALUES
    ('supplier_performance.view', 'supplier_management', 'View supplier delivery performance analytics, scorecards, and trends'),
    ('supplier_performance.export', 'supplier_management', 'Export supplier performance analytics and PO line drill-down to CSV/Excel')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;


-- 3. Map Permissions to Roles
-- Super Admin has full view and export authority
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('super_admin', 'supplier_performance.view'),
    ('super_admin', 'supplier_performance.export')
ON CONFLICT DO NOTHING;

-- SCM Admin has full view and export authority
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'supplier_performance.view'),
    ('scm_admin', 'supplier_performance.export')
ON CONFLICT DO NOTHING;

-- SCM Team User has operational view authority
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'supplier_performance.view')
ON CONFLICT DO NOTHING;


-- 4. Authoritative Supplier Performance Analytics RPC
CREATE OR REPLACE FUNCTION public.api_get_supplier_performance_analytics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL,
    p_category VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_result JSONB;
BEGIN
    -- Verify permission
    IF NOT public.current_user_has_permission('supplier_performance.view') 
       AND NOT public.current_user_has_permission('delivery_reports.view') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to view supplier performance analytics.';
    END IF;

    WITH filtered_lines AS (
        SELECT 
            mdt.id,
            mdt.sap_po_number,
            mdt.sap_po_line_number,
            mdt.category,
            mdt.supplier_id,
            mdt.supplier_name,
            mdt.ordered_quantity,
            mdt.delivered_quantity,
            mdt.uom,
            mdt.original_committed_delivery_date,
            mdt.current_expected_delivery_date,
            mdt.actual_completion_date,
            mdt.delivery_status,
            -- Evaluated commitment date
            mdt.original_committed_delivery_date AS committed_date,
            -- Is fully delivered
            (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) AS is_delivered,
            -- Outstanding quantity
            GREATEST(0, mdt.ordered_quantity - mdt.delivered_quantity) AS outstanding_qty,
            -- Delay days against original commitment
            CASE 
                WHEN mdt.original_committed_delivery_date IS NULL THEN NULL
                WHEN (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) THEN 
                    GREATEST(0, (COALESCE(mdt.actual_completion_date, v_today_ist) - mdt.original_committed_delivery_date))
                ELSE 
                    GREATEST(0, (v_today_ist - mdt.original_committed_delivery_date))
            END AS original_delay_days,
            -- Current overdue days against revised expected date
            CASE
                WHEN (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) THEN 0
                WHEN mdt.current_expected_delivery_date IS NULL THEN 0
                ELSE GREATEST(0, (v_today_ist - mdt.current_expected_delivery_date))
            END AS current_overdue_days
        FROM public.material_delivery_tracking mdt
        WHERE mdt.delivery_status <> 'CANCELLED'
          AND (p_supplier_id IS NULL OR mdt.supplier_id = p_supplier_id)
          AND (p_category IS NULL OR mdt.category = p_category)
          AND (p_start_date IS NULL OR COALESCE(mdt.original_committed_delivery_date, mdt.current_expected_delivery_date) >= p_start_date)
          AND (p_end_date IS NULL OR COALESCE(mdt.original_committed_delivery_date, mdt.current_expected_delivery_date) <= p_end_date)
    ),
    scorecard_by_supplier AS (
        SELECT 
            fl.supplier_id,
            COALESCE(fl.supplier_name, 'Unknown Supplier') AS supplier_name,
            COUNT(*) AS total_lines,
            COUNT(*) FILTER (WHERE fl.committed_date IS NULL) AS missing_commitment_count,
            COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL) AS evaluable_lines,
            COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date) AS on_time_delivered_lines,
            COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date > fl.committed_date) AS late_delivered_lines,
            COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.committed_date IS NOT NULL AND v_today_ist > fl.committed_date) AS overdue_outstanding_lines,
            COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.delivered_quantity > 0) AS partial_delivery_lines,
            SUM(fl.outstanding_qty) AS total_outstanding_quantity,
            ROUND(
                AVG(fl.original_delay_days) FILTER (WHERE fl.is_delivered AND fl.original_delay_days > 0),
                1
            ) AS avg_final_delay_days_late,
            COALESCE(
                MAX(fl.original_delay_days) FILTER (WHERE fl.is_delivered),
                0
            ) AS max_final_delay_days,
            ROUND(
                AVG(fl.original_delay_days) FILTER (WHERE NOT fl.is_delivered AND fl.original_delay_days > 0),
                1
            ) AS avg_current_delay_days_overdue
        FROM filtered_lines fl
        GROUP BY fl.supplier_id, fl.supplier_name
    ),
    category_summary AS (
        SELECT 
            fl.category,
            COUNT(*) AS total_lines,
            COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date) AS on_time_lines,
            COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL AND fl.original_delay_days > 0) AS delayed_lines,
            COUNT(*) FILTER (WHERE fl.committed_date IS NULL) AS missing_commitment_count,
            ROUND(
                CASE 
                    WHEN COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL) > 0 THEN 
                        (COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date)::NUMERIC / 
                         COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL)::NUMERIC) * 100
                    ELSE 0 
                END, 
                1
            ) AS on_time_percentage
        FROM filtered_lines fl
        GROUP BY fl.category
    ),
    delay_reasons_summary AS (
        SELECT 
            dl.delay_reason_category,
            COUNT(*) AS occurrences_count,
            COUNT(DISTINCT dl.tracking_id) AS distinct_lines_affected
        FROM public.material_delivery_delay_logs dl
        JOIN filtered_lines fl ON fl.id = dl.tracking_id
        GROUP BY dl.delay_reason_category
        ORDER BY occurrences_count DESC
        LIMIT 10
    )
    SELECT jsonb_build_object(
        'as_of_date_ist', v_today_ist,
        'filters', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date,
            'supplier_id', p_supplier_id,
            'category', p_category
        ),
        'overall_summary', (
            SELECT jsonb_build_object(
                'total_lines', COUNT(*),
                'total_delivered_lines', COUNT(*) FILTER (WHERE fl.is_delivered),
                'total_on_time_lines', COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date),
                'total_late_completed_lines', COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date > fl.committed_date),
                'total_overdue_outstanding_lines', COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.committed_date IS NOT NULL AND v_today_ist > fl.committed_date),
                'total_partial_lines', COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.delivered_quantity > 0),
                'total_missing_commitment_lines', COUNT(*) FILTER (WHERE fl.committed_date IS NULL),
                'on_time_delivery_rate', ROUND(
                    CASE 
                        WHEN COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL) > 0 THEN 
                            (COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date)::NUMERIC / 
                             COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL)::NUMERIC) * 100
                        ELSE 0 
                    END, 
                    1
                ),
                'avg_final_delay_days', COALESCE(ROUND(AVG(fl.original_delay_days) FILTER (WHERE fl.is_delivered AND fl.original_delay_days > 0), 1), 0),
                'max_final_delay_days', COALESCE(MAX(fl.original_delay_days) FILTER (WHERE fl.is_delivered), 0),
                'avg_current_delay_days', COALESCE(ROUND(AVG(fl.original_delay_days) FILTER (WHERE NOT fl.is_delivered AND fl.original_delay_days > 0), 1), 0)
            ) FROM filtered_lines fl
        ),
        'supplier_scorecards', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'supplier_id', s.supplier_id,
                    'supplier_name', s.supplier_name,
                    'total_lines', s.total_lines,
                    'evaluable_lines', s.evaluable_lines,
                    'missing_commitment_count', s.missing_commitment_count,
                    'on_time_delivered_lines', s.on_time_delivered_lines,
                    'late_delivered_lines', s.late_delivered_lines,
                    'overdue_outstanding_lines', s.overdue_outstanding_lines,
                    'partial_delivery_lines', s.partial_delivery_lines,
                    'total_outstanding_quantity', s.total_outstanding_quantity,
                    'on_time_percentage', ROUND(
                        CASE 
                            WHEN s.evaluable_lines > 0 THEN 
                                (s.on_time_delivered_lines::NUMERIC / s.evaluable_lines::NUMERIC) * 100
                            ELSE 0 
                        END, 
                        1
                    ),
                    'avg_final_delay_days_late', COALESCE(s.avg_final_delay_days_late, 0),
                    'max_final_delay_days', s.max_final_delay_days,
                    'avg_current_delay_days_overdue', COALESCE(s.avg_current_delay_days_overdue, 0)
                ) ORDER BY s.total_lines DESC, s.supplier_name ASC
            ), '[]'::jsonb) FROM scorecard_by_supplier s
        ),
        'category_breakdown', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', c.category,
                    'total_lines', c.total_lines,
                    'on_time_lines', c.on_time_lines,
                    'delayed_lines', c.delayed_lines,
                    'missing_commitment_count', c.missing_commitment_count,
                    'on_time_percentage', c.on_time_percentage
                )
            ), '[]'::jsonb) FROM category_summary c
        ),
        'delay_reasons_breakdown', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', dr.delay_reason_category,
                    'occurrences_count', dr.occurrences_count,
                    'distinct_lines_affected', dr.distinct_lines_affected
                )
            ), '[]'::jsonb) FROM delay_reasons_summary dr
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.api_get_supplier_performance_analytics(DATE, DATE, UUID, VARCHAR) TO authenticated, service_role;

COMMIT;

