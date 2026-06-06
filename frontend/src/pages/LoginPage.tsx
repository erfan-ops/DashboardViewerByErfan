import { useState, useEffect } from 'react'
import { Button, Container, FormControl, FormLabel, Heading, HStack, Input, Stack, useToast } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import ThemeToggle from '../components/ThemeToggle'

export default function LoginPage() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const t = localStorage.getItem('jwt')
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
      navigate('/')
    }
  }, [navigate])

  const login = async () => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    try {
      const res = await axios.post('/api/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const t = res.data.access_token;
      localStorage.setItem('jwt', t);
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
      toast({ status: 'success', title: 'Logged in', duration: 2000 });
      navigate('/');
    } catch (e: any) {
      toast({ status: 'error', title: 'Login failed', description: e?.response?.data?.detail || String(e) });
    }
  };


  const register = async () => {
    try {
      navigate('/register');
    } catch (e: any) {
      toast({ status: 'error', title: 'Login failed', description: e?.response?.data?.detail || String(e) });
    }
  };

  return (
    <Container maxW="md" py={12}>
      <Stack spacing={6}>
        <HStack justify="space-between">
          <Heading size="lg">Login</Heading>
          <ThemeToggle />
        </HStack>

        <FormControl>
          <FormLabel>Username</FormLabel>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && login()} />
        </FormControl>

        <FormControl>
          <FormLabel>Password</FormLabel>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && login()} />
        </FormControl>

        <Button colorScheme="blue" onClick={login} width="full">Login</Button>
        <Button colorScheme="blue" onClick={register} width="full">Register</Button>
      </Stack>
    </Container>
  )
}
