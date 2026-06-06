import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  SimpleGrid,
  Text,
  VStack,
  Heading,
  Spinner,
  Button,
  useToast,
  Flex,
  Icon,
  Badge,
  Container,
  IconButton,
} from '@chakra-ui/react';
import { FiGrid, FiPlus, FiFolder, FiArrowLeft, FiRefreshCw, FiEdit3 } from 'react-icons/fi';
import { toPersianDigits } from '../core/utils';

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  last_opened?: string;
}

const HomePage: React.FC = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<Array<string>>([]);
  const navigate = useNavigate();
  const toast = useToast();

  // Color palette based on user's specifications
  const colors = {
    primary: '#6B5DF7',
    primaryHover: '#5A45BF',
    primaryLight: '#B4A4FF',
    primaryLighter: '#CABEFF',
    primaryDark: '#4328BF',
    accent: '#03A679',
    accentHover: '#028A65',
    text: '#2D3748',
    textLight: '#718096',
    background: '#F7FAFC',
  };

  // Check if user has admin or editor privileges
  const hasEditorAccess = userRoles.includes('admin') || userRoles.includes('dashboard_editor');

  useEffect(() => {
    const t = localStorage.getItem('jwt')
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
    } else {
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    fetchDashboards();
    fetchUserRoles();
  }, []);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/dashboards/mine');
      setDashboards(response.data);
    } catch (err) {
      const errorMessage = 'بارگذاری داشبوردها ناموفق بود. لطفا دوباره تلاش کنید.';
      setError(errorMessage);
      toast({
        title: 'خطا',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRoles = async () => {
    try {
      const res = await axios.get(`/api/user/roles`)
      setUserRoles(res.data)
    } catch (e: any) {
      if (e?.response?.status === 401) navigate('/login')
      else toast({ status: 'error', title: 'دریافت نقش‌های کاربر ناموفق بود', description: e?.response?.data?.detail || String(e) })
    }
  };

  const handleDashboardClick = (id: string) => {
    // Add a subtle click animation before navigation
    const element = document.getElementById(`dashboard-${id}`);
    if (element) {
      element.style.transform = 'scale(0.98)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
        navigate(`/viewer/${id}`);
      }, 150);
    } else {
      navigate(`/viewer/${id}`);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'به روز نشده';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'دیروز';
    if (diffDays < 7) return `${toPersianDigits(diffDays)} روز پیش`;
    if (diffDays < 30) return `${toPersianDigits(Math.floor(diffDays / 7))} هفته پیش`;
    return date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Box minH="100vh" bg={colors.background} display="flex" alignItems="center" justifyContent="center" dir="rtl">
        <VStack spacing={4}>
          <Spinner size="xl" color={colors.primary} thickness="3px" />
          <Text color={colors.textLight} fontSize="lg">در حال بارگذاری داشبوردهای شما...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg={colors.background} dir="rtl">
      {/* Header */}
      <Box
        bg="white"
        borderBottom="1px"
        borderColor="gray.100"
        position="sticky"
        top={0}
        zIndex={10}
        backdropFilter="blur(10px)"
        bgColor="rgba(255, 255, 255, 0.95)"
      >
        <Container maxW="container.xl" py={4}>
          <Flex justify="space-between" align="center">
            {/* Right side: Title and count */}
            <Flex align="center" gap={3}>
              <Icon as={FiGrid} w={6} h={6} color={colors.primary} />
              <Heading size="lg" color={colors.text} fontWeight="600">
                داشبوردهای من
              </Heading>
            </Flex>
            
            {/* Left side: Buttons */}
            <Flex gap={3}>
              <Button
                rightIcon={<FiPlus />}
                onClick={() => navigate('/create')}
                variant="solid"
                bg={colors.primary}
                color="white"
                _hover={{
                  bg: colors.primaryHover,
                  transform: 'translateY(-1px)',
                }}
                transition="all 0.2s"
              >
                داشبورد جدید
              </Button>
              
              {/* Editor button - only shown for admins and dashboard_editors */}
              {hasEditorAccess && (
                <Button
                  rightIcon={<FiEdit3 />}
                  onClick={() => navigate('/editor')}
                  variant="outline"
                  borderColor={colors.accent}
                  color={colors.accent}
                  _hover={{
                    bg: colors.accent + '10',
                    borderColor: colors.accentHover,
                    color: colors.accentHover,
                  }}
                >
                  ویرایشگر
                </Button>
              )}
              
              <IconButton
                aria-label="بروزرسانی داشبوردها"
                icon={<FiRefreshCw />}
                onClick={fetchDashboards}
                variant="outline"
                borderColor={colors.primary}
                color={colors.primary}
                _hover={{
                  bg: colors.primaryLighter,
                  borderColor: colors.primaryHover,
                }}
              />
            </Flex>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={8}>
        {error && (
          <Box
            bg="red.50"
            border="1px solid"
            borderColor="red.200"
            borderRadius="lg"
            p={6}
            mb={6}
            textAlign="center"
          >
            <Text color="red.600" mb={4}>{error}</Text>
            <Button
              onClick={fetchDashboards}
              bg={colors.primary}
              color="white"
              _hover={{ bg: colors.primaryHover }}
            >
              تلاش مجدد
            </Button>
          </Box>
        )}

        {dashboards.length === 0 && !loading && (
          <Box
            textAlign="center"
            py={20}
            bg="white"
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.100"
          >
            <VStack spacing={6} maxW="md" mx="auto">
              <Box
                w={20}
                h={20}
                bg={colors.primaryLighter}
                borderRadius="xl"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon as={FiFolder} w={10} h={10} color={colors.primary} />
              </Box>
              <Heading size="md" color={colors.text}>هنوز داشبوردی وجود ندارد</Heading>
              <Text color={colors.textLight}>
                برای شروع کار با بصری سازی داده ها، اولین داشبورد خود را ایجاد کنید.
              </Text>
              {/* Show editor button in empty state too if user has access */}
              <Flex gap={3}>
                <Button
                  rightIcon={<FiPlus />}
                  onClick={() => navigate('/create')}
                  bg={colors.primary}
                  color="white"
                  _hover={{
                    bg: colors.primaryHover,
                    transform: 'translateY(-1px)',
                  }}
                  transition="all 0.2s"
                  px={8}
                >
                  ایجاد داشبورد
                </Button>
                
                {hasEditorAccess && (
                  <Button
                    rightIcon={<FiEdit3 />}
                    onClick={() => navigate('/editor')}
                    variant="outline"
                    borderColor={colors.accent}
                    color={colors.accent}
                    _hover={{
                      bg: colors.accent + '10',
                      borderColor: colors.accentHover,
                      color: colors.accentHover,
                    }}
                  >
                    برو به ویرایشگر
                  </Button>
                )}
              </Flex>
            </VStack>
          </Box>
        )}

        {dashboards.length > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={6}>
            {dashboards.map((dashboard, index) => (
              <Box
                key={dashboard.id}
                id={`dashboard-${dashboard.id}`}
                role="group"
                bg="white"
                borderRadius="xl"
                border="1px solid"
                borderColor="gray.100"
                p={6}
                cursor="pointer"
                onClick={() => handleDashboardClick(dashboard.id)}
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                _hover={{
                  transform: 'translateY(-4px)',
                  boxShadow: 'lg',
                  borderColor: colors.primaryLight,
                }}
                style={{
                  animationDelay: `${index * 0.05}s`,
                  animation: 'fadeIn 0.5s ease-out forwards',
                  opacity: 0,
                }}
              >
                {/* Card Header */}
                <Flex justify="space-between" align="start" mb={4}>
                  {/* Card content aligned to right */}
                  <Box flex="1" textAlign="right">
                    <Heading
                      size="md"
                      color={colors.text}
                      fontWeight="600"
                      mb={1}
                      noOfLines={1}
                    >
                      {dashboard.name}
                    </Heading>
                    {/* Card Content */}
                    {dashboard.description && (
                      <Text
                        color={colors.textLight}
                        fontSize="sm"
                        mb={4}
                        noOfLines={2}
                      >
                        {dashboard.description}
                      </Text>
                    )}
                  </Box>
                  
                  {/* Arrow icon on the left side */}
                  <Icon
                    as={FiArrowLeft}
                    w={5}
                    h={5}
                    color={colors.primary}
                    opacity={0}
                    transition="all 0.3s"
                    _groupHover={{
                      opacity: 1,
                      transform: 'translateX(-4px)',
                    }}
                  />
                </Flex>

                <Text color={colors.textLight} fontSize="sm" textAlign="right">
                  به روز شده: {formatDate(dashboard.last_opened)}
                </Text>

                {/* Hover Overlay Effect */}
                <Box
                  position="absolute"
                  top={0}
                  right={0}
                  left={0}
                  bottom={0}
                  borderRadius="xl"
                  bgGradient="linear(to-br, rgba(107, 93, 247, 0.02), rgba(3, 166, 121, 0.02))"
                  opacity={0}
                  transition="opacity 0.3s"
                  pointerEvents="none"
                  _groupHover={{ opacity: 1 }}
                />
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Container>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Box>
  );
};

export default HomePage;