import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    // Simulate login for dev purposes without actual supabase setup yet
    if (!import.meta.env.VITE_SUPABASE_URL) {
      if (email.includes('admin')) navigate('/admin')
      else navigate('/staff')
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // If auth.users fails, check if credentials belong to a staff member in public.staff
      const { data: staffData, error: rpcError } = await supabase.rpc('verify_staff_login', {
        p_email: email,
        p_password: password
      })

      if (rpcError) {
        setError(`Database Error: ${rpcError.message}`)
        setLoading(false)
        return
      }

      if (!staffData || staffData.length === 0) {
        setError("Invalid email or password.")
        setLoading(false)
        return
      }

      localStorage.setItem('staff', JSON.stringify({ ...staffData[0], password }))
      navigate('/staff')
      setLoading(false)
      return
    }

    // Fetch user profile to get role for admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user?.id)
      .single()

    console.log("Profile Data:", profileData);
    console.log("Profile Error:", profileError);

    if (profileError) {
      setError(`Error fetching profile: ${profileError.message}`)
      setLoading(false)
      return
    }

    if (profileData?.role === 'admin') {
      navigate('/admin')
    } else {
      setError('Access denied. Staff and Students must use the respective portals.')
      await supabase.auth.signOut()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md shadow-lg border-0 ring-1 ring-zinc-200 dark:ring-zinc-800">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">CodeTrack Pro</CardTitle>
          <CardDescription>
            Admin & Staff Portal Login
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
              <Input 
                type="email" 
                placeholder="m@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Password</label>
              <Input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Login;
