import { useEffect, useState, useCallback } from 'react'
import { 
  Box, Button, Container, FormControl, FormLabel, Heading, 
  HStack, Input, Stack, Table, Tbody, Td, Th, Thead, Tr, 
  useToast, VStack, Text, Divider, Card, CardBody, 
  useColorModeValue 
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import axios from 'axios'
import ThemeToggle from '../components/ThemeToggle'

interface SavedQuery {
  name: string
  sql_text: string
}

export default function EditorPage() {
  const [sql, setSql] = useState('SELECT * FROM dual')
  const [queryName, setQueryName] = useState('Untitled')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  // Color values for light/dark theme
  const bgColor = useColorModeValue('white', 'gray.800')
  const sidebarBg = useColorModeValue('gray.50', 'gray.700')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const hoverBg = useColorModeValue('gray.100', 'gray.600')
  const textMuted = useColorModeValue('gray.600', 'gray.400')
  const cardBg = useColorModeValue('white', 'gray.750')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')

  const fetchSavedQueries = useCallback(async () => {
    try {
      const res = await axios.get('/api/editor/sql/saved')
      setSavedQueries(res.data.queries || [])
    } catch (e: any) {
      if (e?.response?.status === 401) {
        navigate('/login')
      } else {
        toast({ 
          status: 'error', 
          title: 'Failed to fetch saved queries', 
          description: e?.response?.data?.detail || String(e) 
        })
      }
    }
  }, [navigate, toast])

  useEffect(() => {
    const t = localStorage.getItem('jwt')
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
      fetchSavedQueries()
    } else {
      navigate('/login')
    }
  }, [navigate, fetchSavedQueries])

  const execute = async () => {
    setIsExecuting(true)
    try {
      const res = await axios.post('/api/editor/sql/execute', { sql, limit: 200 })
      setColumns(res.data.columns)
      setRows(res.data.rows)
    } catch (e: any) {
      if (e?.response?.status === 401) {
        navigate('/login')
      } else {
        toast({ 
          status: 'error', 
          title: 'Execution failed', 
          description: e?.response?.data?.detail || String(e) 
        })
      }
    } finally {
      setIsExecuting(false)
    }
  }

  const save = async () => {
    try {
      await axios.post('/api/editor/sql/save', { sql, name: queryName })
      toast({ 
        status: 'success', 
        title: 'Query saved successfully' 
      })
      fetchSavedQueries()
    } catch (e: any) {
      if (e?.response?.status === 401) {
        navigate('/login')
      } else {
        toast({ 
          status: 'error', 
          title: 'Save failed', 
          description: e?.response?.data?.detail || String(e) 
        })
      }
    }
  }

  const loadQuery = (query: SavedQuery) => {
    setSql(query.sql_text)
    setQueryName(query.name)
  }

  return (
    <Container maxW="8xl" py={8} px={6}>
      <HStack spacing={8} align="flex-start" height="calc(100vh - 100px)">
        {/* Main Content */}
        <Stack spacing={6} flex={1} height="full">
          {/* Header */}
          <Card variant="elevated" bg={cardBg}>
            <CardBody py={4}>
              <HStack justify="space-between" align="center">
                <VStack align="flex-start" spacing={1}>
                  <Heading size="lg" fontWeight="700">SQL Editor</Heading>
                  <Text fontSize="sm" color={textMuted}>
                    Write and execute SQL queries
                  </Text>
                </VStack>
                <ThemeToggle />
              </HStack>
            </CardBody>
          </Card>

          {/* Query Name */}
          <Card variant="elevated" bg={cardBg}>
            <CardBody>
              <FormControl>
                <FormLabel fontWeight="600" mb={2}>Query Name</FormLabel>
                <Input 
                  value={queryName} 
                  onChange={(e) => setQueryName(e.target.value)} 
                  placeholder="Enter a descriptive name for your query"
                  size="lg"
                  borderRadius="md"
                />
              </FormControl>
            </CardBody>
          </Card>

          {/* Editor */}
          <Card variant="elevated" bg={cardBg} flex={1}>
            <CardBody p={0} display="flex" flexDirection="column">
              <Box 
                flex={1} 
                borderWidth="1px" 
                borderColor={borderColor}
                borderRadius="md"
                overflow="hidden"
              >
                <Editor 
                  height="100%"
                  defaultLanguage="sql" 
                  value={sql} 
                  onChange={(v) => setSql(v || '')} 
                  theme={useColorModeValue('vs-light', 'vs-dark')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineHeight: 1.5,
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </Box>
            </CardBody>
          </Card>

          {/* Actions */}
          <Card variant="elevated" bg={cardBg}>
            <CardBody py={4}>
              <HStack spacing={4}>
                <Button 
                  colorScheme="blue" 
                  onClick={execute}
                  isLoading={isExecuting}
                  loadingText="Executing..."
                  size="lg"
                  px={8}
                >
                  Run Query
                </Button>
                <Button 
                  colorScheme="green" 
                  onClick={save}
                  variant="outline"
                  size="lg"
                  px={8}
                >
                  Save Query
                </Button>
              </HStack>
            </CardBody>
          </Card>

          {/* Results */}
          {columns.length > 0 && (
            <Card variant="elevated" bg={cardBg}>
              <CardBody p={0}>
                <Box overflowX="auto" maxH="400px" borderRadius="xl">
                  <Table size="md" variant="simple">
                    <Thead position="sticky" top={0} bg={tableHeaderBg}>
                      <Tr>
                        {columns.map((c) => (
                          <Th key={c} fontWeight="700" color="inherit" borderColor={borderColor}>
                            {c}
                          </Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {rows.map((r, idx) => (
                        <Tr 
                          key={idx} 
                          _hover={{ bg: hoverBg }}
                          transition="background-color 0.1s"
                        >
                          {r.map((cell, j) => (
                            <Td key={j} borderColor={borderColor}>
                              {String(cell)}
                            </Td>
                          ))}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
                <Box p={4} borderTopWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" color={textMuted}>
                    Showing {rows.length} row{rows.length !== 1 ? 's' : ''}
                  </Text>
                </Box>
              </CardBody>
            </Card>
          )}
        </Stack>

        {/* Saved Queries Sidebar */}
        <Box 
          width="400px" 
          height="full"
          bg={sidebarBg}
          borderRadius="xl"
          p={6}
          borderWidth="1px"
          borderColor={borderColor}
        >
          <VStack align="stretch" spacing={4} height="full">
            <VStack align="stretch" spacing={2}>
              <Heading size="md" fontWeight="700">Saved Queries</Heading>
              <Text fontSize="sm" color={textMuted}>
                Click on a query to load it into the editor
              </Text>
            </VStack>
            
            <Divider borderColor={borderColor} />
            
            {savedQueries.length === 0 ? (
              <Box 
                textAlign="center" 
                py={8} 
                borderRadius="lg"
                bg={useColorModeValue('gray.100', 'gray.600')}
              >
                <Text color={textMuted} fontSize="sm">
                  No saved queries yet
                </Text>
                <Text color={textMuted} fontSize="xs" mt={1}>
                  Save your first query to see it here
                </Text>
              </Box>
            ) : (
              <VStack 
                align="stretch" 
                spacing={3} 
                height="full" 
                overflowY="auto"
                pr={2}
                css={{
                  '&::-webkit-scrollbar': {
                    width: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    width: '6px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: useColorModeValue('gray.300', 'gray.500'),
                    borderRadius: '24px',
                  },
                }}
              >
                {savedQueries.map((query, idx) => (
                  <Card 
                    key={idx}
                    variant="outline"
                    borderColor={borderColor}
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{
                      transform: 'translateY(-2px)',
                      shadow: 'md',
                      borderColor: useColorModeValue('blue.300', 'blue.500'),
                      bg: useColorModeValue('blue.50', 'gray.600'),
                    }}
                    onClick={() => loadQuery(query)}
                  >
                    <CardBody py={3}>
                      <Text 
                        fontWeight="600" 
                        fontSize="sm" 
                        mb={2}
                        noOfLines={1}
                      >
                        {query.name}
                      </Text>
                      <Text 
                        fontSize="xs" 
                        color={textMuted}
                        fontFamily="mono"
                        noOfLines={2}
                        whiteSpace="pre-wrap"
                      >
                        {query.sql_text}
                      </Text>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            )}
          </VStack>
        </Box>
      </HStack>
    </Container>
  )
}