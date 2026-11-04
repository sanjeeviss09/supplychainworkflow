-- =============================================================================
-- SCM FLOW — PHASE 10: INCOMING MATERIAL DELIVERY PLANNING & SCHEDULE MANAGEMENT
-- File: backend/supabase/migrations/20261103100000_phase10_delivery_planning_calendar.sql
-- =============================================================================

BEGIN;

-- 1. Index Optimizations for Date-Based Planning Queries
CREATE INDEX IF NOT EXISTS idx_mdt_expected_status 
ON public.material_delivery_tracking(current_expected_delivery_date, delivery_status);

CREATE INDEX IF NOT EXISTS idx_mdt_assigned_expected 
ON public.material_delivery_tracking(assigned_employee_id, current_expected_delivery_date);

CREATE INDEX IF NOT EXISTS idx_ddh_changed_at 
ON public.delivery_date_history(changed_at);


-- 2. Seed Granular Permissions for Delivery Planning
INSERT INTO public.permissions (id, module, description) VALUES
    ('delivery_planning.view', 'delivery_planning', 'View incoming material delivery schedule, calendar, and workload planning'),
    ('delivery_planning.export', 'delivery_planning', 'Export incoming delivery schedules, calendar agendas, and workload summaries')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;


-- 3. Map Permissions to Roles
-- Super Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('super_admin', 'delivery_planning.view'),
    ('super_admin', 'delivery_planning.export')
ON CONFLICT DO NOTHING;

-- SCM Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'delivery_planning.view'),
    ('scm_admin', 'delivery_planning.export')
ON CONFLICT DO NOTHING;

-- SCM Team User (Full planning view and operational export)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'delivery_planning.view'),
    ('scm_team_user', 'delivery_planning.export')
ON CONFLICT DO NOTHING;


-- 4. Authoritative Planning & Calendar Schedule RPC
CREATE OR REPLACE FUNCTION public.api_get_delivery_planning_schedule(
    p_start_date DATE,
    p_end_date DATE,
    p_supplier_id UUID DEFAULT NULL,
    p_category VARCHAR DEFAULT NULL,
    p_assigned_employee_id UUID DEFAULT NULL
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
    -- Authorization check
    IF NOT public.current_user_has_permission('delivery_planning.view') 
       AND NOT public.current_user_has_permission('deliveries.view') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to view delivery planning schedules.';
    END IF;

    WITH filtered_tracking AS (
        SELECT 
            mdt.id,
            mdt.sap_po_number,
            mdt.sap_po_line_number,
            mdt.category,
            mdt.material_code,
            mdt.material_description,
            mdt.supplier_id,
            mdt.supplier_name,
            mdt.ordered_quantity,
            mdt.delivered_quantity,
            GREATEST(0, mdt.ordered_quantity - mdt.delivered_quantity) AS outstanding_quantity,
            mdt.uom,
            mdt.assigned_employee_id,
            e.full_name AS assigned_employee_name,
            e.employee_id AS assigned_employee_code,
            mdt.original_committed_delivery_date,
            mdt.current_expected_delivery_date,
            mdt.actual_completion_date,
            mdt.delivery_status,
            -- Evaluated operational date for calendar placement
            COALESCE(mdt.current_expected_delivery_date, mdt.original_committed_delivery_date) AS operational_date,
            -- Status indicators
            (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) AS is_delivered,
            (mdt.delivered_quantity > 0 AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_partial,
            (mdt.current_expected_delivery_date = v_today_ist AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_due_today,
            (mdt.original_committed_delivery_date IS NOT NULL AND v_today_ist > mdt.original_committed_delivery_date AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_overdue,
            (mdt.current_expected_delivery_date > v_today_ist AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_upcoming,
            -- Delay days against original commitment
            CASE 
                WHEN mdt.original_committed_delivery_date IS NULL THEN NULL
                WHEN (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) THEN 
                    GREATEST(0, (COALESCE(mdt.actual_completion_date, v_today_ist) - mdt.original_committed_delivery_date))
                ELSE 
                    GREATEST(0, (v_today_ist - mdt.original_committed_delivery_date))
            END AS original_delay_days,
            -- Open Issue flags from Phase 9
            EXISTS (
                SELECT 1 FROM public.delivery_issues di 
                WHERE di.tracking_id = mdt.id AND di.status NOT IN ('Resolved', 'Closed')
            ) AS has_open_issue,
            EXISTS (
                SELECT 1 FROM public.delivery_issues di 
                WHERE di.tracking_id = mdt.id AND di.status NOT IN ('Resolved', 'Closed') AND di.severity IN ('High', 'Critical')
            ) AS has_critical_issue
        FROM public.material_delivery_tracking mdt
        LEFT JOIN public.employees e ON e.id = mdt.assigned_employee_id
        WHERE mdt.delivery_status <> 'CANCELLED'
          AND (p_supplier_id IS NULL OR mdt.supplier_id = p_supplier_id)
          AND (p_category IS NULL OR mdt.category = p_category)
          AND (p_assigned_employee_id IS NULL OR mdt.assigned_employee_id = p_assigned_employee_id)
          AND (
              COALESCE(mdt.current_expected_delivery_date, mdt.original_committed_delivery_date) BETWEEN p_start_date AND p_end_date
              OR (mdt.delivered_quantity < mdt.ordered_quantity AND mdt.original_committed_delivery_date < p_start_date) -- include carried-over overdue
          )
    ),
    uom_quantity_aggregations AS (
        SELECT 
            ft.uom,
            ft.category,
            COUNT(*) AS po_lines_count,
            SUM(ft.ordered_quantity) AS total_ordered_qty,
            SUM(ft.delivered_quantity) AS total_delivered_qty,
            SUM(ft.outstanding_quantity) AS total_outstanding_qty
        FROM filtered_tracking ft
        GROUP BY ft.uom, ft.category
    ),
    calendar_daily_groups AS (
        SELECT 
            ft.operational_date,
            COUNT(*) AS lines_count,
            COUNT(*) FILTER (WHERE ft.is_delivered) AS delivered_count,
            COUNT(*) FILTER (WHERE ft.is_partial) AS partial_count,
            COUNT(*) FILTER (WHERE ft.has_critical_issue) AS critical_issue_count,
            jsonb_agg(
                jsonb_build_object(
                    'id', ft.id,
                    'sap_po_number', ft.sap_po_number,
                    'sap_po_line_number', ft.sap_po_line_number,
                    'category', ft.category,
                    'material_code', ft.material_code,
                    'material_description', ft.material_description,
                    'supplier_name', ft.supplier_name,
                    'ordered_quantity', ft.ordered_quantity,
                    'delivered_quantity', ft.delivered_quantity,
                    'outstanding_quantity', ft.outstanding_quantity,
                    'uom', ft.uom,
                    'assigned_employee_name', ft.assigned_employee_name,
                    'original_committed_delivery_date', ft.original_committed_delivery_date,
                    'current_expected_delivery_date', ft.current_expected_delivery_date,
                    'delivery_status', ft.delivery_status,
                    'original_delay_days', ft.original_delay_days,
                    'has_open_issue', ft.has_open_issue,
                    'has_critical_issue', ft.has_critical_issue
                ) ORDER BY ft.has_critical_issue DESC, ft.sap_po_number ASC
            ) AS line_items
        FROM filtered_tracking ft
        WHERE ft.operational_date IS NOT NULL
        GROUP BY ft.operational_date
    )
    SELECT jsonb_build_object(
        'as_of_date_ist', v_today_ist,
        'window', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        ),
        'summary', (
            SELECT jsonb_build_object(
                'total_scheduled_lines', COUNT(*),
                'due_today_count', COUNT(*) FILTER (WHERE ft.is_due_today),
                'upcoming_7d_count', COUNT(*) FILTER (WHERE ft.is_upcoming AND ft.operational_date <= v_today_ist + 7),
                'upcoming_15d_count', COUNT(*) FILTER (WHERE ft.is_upcoming AND ft.operational_date <= v_today_ist + 15),
                'upcoming_30d_count', COUNT(*) FILTER (WHERE ft.is_upcoming AND ft.operational_date <= v_today_ist + 30),
                'overdue_count', COUNT(*) FILTER (WHERE ft.is_overdue),
                'partial_count', COUNT(*) FILTER (WHERE ft.is_partial),
                'fully_delivered_count', COUNT(*) FILTER (WHERE ft.is_delivered),
                'critical_issue_count', COUNT(*) FILTER (WHERE ft.has_critical_issue),
                'unassigned_count', COUNT(*) FILTER (WHERE ft.assigned_employee_id IS NULL)
            ) FROM filtered_tracking ft
        ),
        'uom_workload_breakdown', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'uom', u.uom,
                    'category', u.category,
                    'lines_count', u.po_lines_count,
                    'ordered_qty', u.total_ordered_qty,
                    'delivered_qty', u.total_delivered_qty,
                    'outstanding_qty', u.total_outstanding_qty
                ) ORDER BY u.category ASC, u.uom ASC
            ), '[]'::jsonb) FROM uom_quantity_aggregations u
        ),
        'calendar_days', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', cdg.operational_date,
                    'lines_count', cdg.lines_count,
                    'delivered_count', cdg.delivered_count,
                    'partial_count', cdg.partial_count,
                    'critical_issue_count', cdg.critical_issue_count,
                    'line_items', cdg.line_items
                ) ORDER BY cdg.operational_date ASC
            ), '[]'::jsonb) FROM calendar_daily_groups cdg
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_delivery_planning_schedule(DATE, DATE, UUID, VARCHAR, UUID) TO authenticated, service_role;

COMMIT;

