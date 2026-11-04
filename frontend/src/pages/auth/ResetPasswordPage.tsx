import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

export function ResetPasswordPage() {
  const { changePassword, mustChangePassword, employee, user } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    // Do not allow setting to default temporary password 'AXX09'
    if (password === 'AXX09') {
      setErrorMsg('You cannot reuse the default temporary password. Please choose a new secure password.');
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword(password);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg('Your password has been successfully updated! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/app/dashboard', { replace: true });
      }, 1500);
    } else {
      setErrorMsg(result.error || 'Failed to update password.');
    }
  };

  return (
    <Card className="border border-divider bg-ivory-surface text-ink-primary shadow-warm-xl">
      <CardHeader className="space-y-1.5 pb-4 border-b border-divider/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold tracking-tight text-forest">
            {mustChangePassword ? 'Rotate Temporary Password' : 'Set New Password'}
          </CardTitle>
          <div className="flex items-center space-x-1 rounded-full bg-copper-pale px-2.5 py-0.5 text-[11px] font-semibold text-copper-dark border border-copper/30">
            <ShieldCheck className="h-3 w-3 mr-1 text-copper" />
            <span>Security Policy</span>
          </div>
        </div>
        <CardDescription className="text-xs text-ink-secondary">
          {mustChangePassword ? (
            <span>
              Account <strong className="text-forest font-mono">{employee?.employee_id || user?.email}</strong> is using a temporary bootstrap password. Security policy requires password rotation before continuing.
            </span>
          ) : (
            'Enter your new secure corporate password below.'
          )}
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

          {successMsg && (
            <Alert variant="success" className="py-2.5">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-xs font-medium">{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
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

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
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
                Updating Security Credentials...
              </>
            ) : (
              'Save New Password & Continue'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
