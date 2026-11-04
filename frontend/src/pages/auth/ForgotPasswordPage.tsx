import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Please enter your Employee ID or Work Email.');
      return;
    }

    setIsSubmitting(true);
    const result = await requestPasswordReset(identifier.trim());
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg(
        result.message || 'Password reset instructions have been dispatched to your corporate email.'
      );
    } else {
      setErrorMsg(result.error || 'Failed to dispatch reset instructions.');
    }
  };

  return (
    <Card className="border border-divider bg-ivory-surface text-ink-primary shadow-warm-xl">
      <CardHeader className="space-y-1.5 pb-4 border-b border-divider/60">
        <div className="flex items-center space-x-2">
          <Link to="/login" className="text-ink-secondary hover:text-forest transition-colors p-1 rounded-md hover:bg-ivory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <CardTitle className="text-xl font-bold tracking-tight text-forest">Forgot Password</CardTitle>
        </div>
        <CardDescription className="text-xs text-ink-secondary">
          Enter your registered Employee ID or Work Email to receive secure password recovery instructions.
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

          <div className="space-y-1.5">
            <Label htmlFor="identifier">Employee ID / Work Email</Label>
            <div className="relative">
              <Input
                id="identifier"
                type="text"
                placeholder="e.g. AXX09 or user@company.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isSubmitting || !!successMsg}
                className="pr-10"
                required
              />
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-3 border-t border-divider/60">
          {!successMsg ? (
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Dispatching Reset Link...
                </>
              ) : (
                'Send Recovery Link'
              )}
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Return to Login</Link>
            </Button>
          )}

          <p className="text-center text-xs text-ink-secondary">
            Remembered your credentials?{' '}
            <Link to="/login" className="text-forest hover:text-forest-deep font-semibold hover:underline">
              Back to Sign In
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
