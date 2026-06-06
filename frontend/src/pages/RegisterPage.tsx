import { useState, useEffect } from 'react'
import { Button, Container, FormControl, FormLabel, Heading, HStack, Input, Stack, useToast } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import ThemeToggle from '../components/ThemeToggle'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const t = localStorage.getItem('jwt')
    if (t) {
      localStorage.removeItem('jwt')
    }
  })

  const register = async () => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('email', email);
    params.append('password', password);
    params.append('confirm_password', passwordConfirm);

    try {
      const res = await axios.post('/api/auth/register', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      navigate('/login');
    } catch (e: any) {
      toast({ status: 'error', title: 'Login failed', description: e?.response?.data?.detail || String(e) });
    }
  };

  return (
    <Container maxW="md" py={12}>
      <Stack spacing={6}>
        <HStack justify="space-between">
          <Heading size="lg">Register</Heading>
          <ThemeToggle />
        </HStack>

        <FormControl>
          <FormLabel>Username</FormLabel>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && register()} placeholder='john123' />
        </FormControl>

        <FormControl>
          <FormLabel>Email</FormLabel>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && register()} placeholder='john@gmail.com' />
        </FormControl>

        <FormControl>
          <FormLabel>Password</FormLabel>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && register()} />
        </FormControl>

        <FormControl>
          <FormLabel>Confirm Password</FormLabel>
          <Input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && register()} />
        </FormControl>

        <Button colorScheme="blue" onClick={register} width="full">Register</Button>
      </Stack>
    </Container>
  )
}
