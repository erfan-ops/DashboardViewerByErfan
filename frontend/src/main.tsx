import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import EditorPage from './pages/EditorPage'
import ViewerPage from './pages/ViewerPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProtectedRoute from './components/ProtectedRoute'
import theme from './theme'
import HomePage from './pages/HomePage'

// Font loading function
const loadFonts = () => {
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: 'Vazir';
      src: url('../fonts/vazir-font-v18.0.0/Vazir.eot');
      src: url('../fonts/vazir-font-v18.0.0/Vazir.eot?#iefix') format('embedded-opentype'),
           url('../fonts/vazir-font-v18.0.0/Vazir.woff') format('woff'),
           url('../fonts/vazir-font-v18.0.0/Vazir.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }

    @font-face {
      font-family: 'Yekan';
      src: url('../fonts/yekan-font/Yekan.eot');
      src: url('../fonts/yekan-font/Yekan.eot?#iefix') format('embedded-opentype'),
           url('../fonts/yekan-font/Yekan.woff') format('woff'),
           url('../fonts/yekan-font/Yekan.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    * {
      font-family: 'Yekan', 'Vazir', sans-serif;
    }
    
    body {
      font-family: 'Yekan', 'Vazir', sans-serif;
    }
  `;
  document.head.appendChild(style);
};

// Load the font immediately before rendering
loadFonts();

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { 
    path: '/editor', 
    element: (
      <ProtectedRoute>
        <EditorPage />
      </ProtectedRoute>
    )
  },
  { 
    path: '/viewer/:id', 
    element: (
      <ProtectedRoute>
        <ViewerPage />
      </ProtectedRoute>
    )
  },
])

const queryClient = new QueryClient()

// Global 401 handler to avoid redirect loops when token is invalid/expired
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      try {
        localStorage.removeItem('jwt')
        delete axios.defaults.headers.common['Authorization']
      } catch {}
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ChakraProvider>
  </React.StrictMode>
)