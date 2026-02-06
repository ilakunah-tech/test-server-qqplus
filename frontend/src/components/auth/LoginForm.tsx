import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FlamesDecor } from '@/components/icons/FlamesDecor';

type LoginFormData = {
  email: string;
  password: string;
  remember?: boolean;
};

export const LoginForm = () => {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('login.invalidEmail')),
        password: z.string().min(1, t('login.passwordRequired')),
        remember: z.boolean().optional(),
      }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      await login(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-purple-200/60 dark:border-gray-600 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src="/загруженное.png" alt="QQ Coffee" className="h-20 w-auto shrink-0" />
            </div>
            <CardTitle className="text-3xl text-brand">QQ Coffee · Artisan+</CardTitle>
            <CardDescription className="text-center">
              {t('login.signInToAccount')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-input text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@test.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('login.password')}</Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
                  {...register('remember')}
                />
                <Label htmlFor="remember" className="ml-2 cursor-pointer">
                  {t('login.rememberMe')}
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('login.signingIn') : t('login.signIn')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <FlamesDecor className="h-24" />
    </div>
  );
};
