import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
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

    if (!employeeId.trim()) {
      setErrorMsg('Please enter your official Employee ID.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid company work email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await signup(employeeId.trim(), email.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg('Account registered successfully! Redirecting to your dashboard...');
      setTimeout(() => {
        navigate('/app/dashboard', { replace: true });
      }, 1500);
    } else {
      setErrorMsg(result.error || 'Registration failed.');
    }
  };

  return (
    <Card className="border border-divider bg-ivory-surface text-ink-primary shadow-warm-xl">
      <CardHeader className="space-y-1.5 pb-4 border-b border-divider/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold tracking-tight text-forest">Create Account</CardTitle>
          <div className="flex items-center space-x-1 rounded-full bg-sage-pale px-2.5 py-0.5 text-[11px] font-semibold text-forest border border-sage/50">
            <span>Employee Self-Registration</span>
          </div>
        </div>
        <CardDescription className="text-xs text-ink-secondary">
          Activate your access by linking your credentials to your approved corporate employee profile.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-5">
          {/* Important Security Notice in Pale Copper */}
          <div className="rounded-lg border border-copper/30 bg-copper-pale/60 p-3 text-xs text-copper-dark">
            <div className="flex items-start space-x-2">
              <ShieldAlert className="h-4 w-4 text-copper shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-copper-dark">Access Policy:</span> Registration is permitted only for active personnel pre-enrolled in the company employee directory.
              </div>
            </div>
          </div>

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

          {/* Employee ID */}
          <div className="space-y-1.5">
            <Label htmlFor="employeeId">Official Employee ID</Label>
            <Input
              id="employeeId"
              type="text"
              placeholder="e.g. EMP-1049 or AXX09"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={isSubmitting}
              className="uppercase font-mono"
              required
            />
          </div>

          {/* Work Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Corporate Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.internal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Create Password</Label>
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
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
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
                Validating Employee Record...
              </>
            ) : (
              'Verify & Activate Account'
            )}
          </Button>

          <p className="text-center text-xs text-ink-secondary">
            Already have an active account?{' '}
            <Link to="/login" className="text-forest hover:text-forest-deep font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
