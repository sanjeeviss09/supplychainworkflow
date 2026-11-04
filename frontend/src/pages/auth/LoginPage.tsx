import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/app/dashboard';

  const handleQuickLogin = async (empId: string) => {
    setIdentifier(empId);
    setPassword('admin123');
    setErrorMsg(null);
    setIsSubmitting(true);
    const result = await login(empId, 'admin123');
    setIsSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrorMsg(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Please enter your Employee ID or Work Email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(identifier.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrorMsg(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  return (
    <Card className="border border-divider bg-ivory-surface text-ink-primary shadow-warm-xl">
      <CardHeader className="space-y-1.5 pb-4 border-b border-divider/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold tracking-tight text-forest">Sign In</CardTitle>
          <div className="flex items-center space-x-1 rounded-full bg-sage-pale px-2.5 py-0.5 text-[11px] font-semibold text-forest border border-sage/50">
            <ShieldCheck className="h-3 w-3 mr-1 text-forest" />
            <span>Employee Access</span>
          </div>
        </div>
        <CardDescription className="text-xs text-ink-secondary">
          Enter your registered Employee ID or Work Email to access the SCM Flow platform.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-5">
          {errorMsg && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Identifier (Employee ID or Email) */}
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Employee ID / Work Email</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="e.g. AXX09 or name@company.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isSubmitting}
              autoComplete="username"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-forest hover:text-forest-deep hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary p-0.5"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center space-x-2 pt-0.5">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-divider bg-ivory text-forest focus:ring-forest cursor-pointer"
            />
            <label htmlFor="remember" className="text-xs text-ink-secondary cursor-pointer select-none">
              Remember my session on this device
            </label>
          </div>

          {/* Development / Quick Access Notice */}
          <div className="rounded-lg border border-sage/60 bg-sage-pale/60 p-3 text-xs text-forest">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 font-semibold text-forest">
                <KeyRound className="h-3.5 w-3.5" />
                <span>Development & Demo Access</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('AXX09');
                  setPassword('admin123');
                  setErrorMsg(null);
                }}
                className="text-[11px] text-forest underline hover:text-forest-deep font-semibold"
              >
                Auto-fill AXX09
              </button>
            </div>
            <p className="text-[11px] text-ink-secondary mb-2.5">
              Select a role for instant 1-click access to the platform:
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('AXX09')}
                disabled={isSubmitting}
                className="flex items-center justify-center rounded border border-forest/30 bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-forest hover:bg-forest hover:text-white transition-colors shadow-warm-xs"
              >
                👑 Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('EMP-1001')}
                disabled={isSubmitting}
                className="flex items-center justify-center rounded border border-forest/30 bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-forest hover:bg-forest hover:text-white transition-colors shadow-warm-xs"
              >
                🏢 SCM Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('EMP-1002')}
                disabled={isSubmitting}
                className="flex items-center justify-center rounded border border-forest/30 bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-forest hover:bg-forest hover:text-white transition-colors shadow-warm-xs"
              >
                📦 SCM Team
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-3 border-t border-divider/60">
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying Credentials...
              </>
            ) : (
              'Sign In to SCM Flow'
            )}
          </Button>

          <p className="text-center text-xs text-ink-secondary">
            Approved employee without an account?{' '}
            <Link to="/signup" className="text-forest hover:text-forest-deep font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
