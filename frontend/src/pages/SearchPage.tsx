import { useState } from 'react'
import { Input, Card, Typography, List, Spin, Empty, Button, message, Tabs, Tag } from 'antd'
import { SearchOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { Title, Paragraph } = Typography
const { Search } = Input

interface SuggestedPage {
  title: string
  category: string
  content: string
}

interface QueryResult {
  answer: string
  citations: string[]
  suggested_page?: SuggestedPage | null
}

interface SearchResultItem {
  page_id: string
  title: string
  snippet: string
  score: number
}

const CATEGORY_COLORS: Record<string, string> = {
  sources: '#87d068',
  entities: '#108ee9',
  concepts: '#f50',
  topics: '#722ed1',
}

export default function SearchPage() {
  const [result, setResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [lastQuestion, setLastQuestion] = useState('')
  const [quickResults, setQuickResults] = useState<SearchResultItem[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const navigate = useNavigate()

  const handleArchive = async (page: SuggestedPage) => {
    setArchiving(true)
    try {
      const resp = await fetch('/api/search/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: page.title,
          category: page.category,
          content: page.content,
          source_question: lastQuestion,
        }),
      })
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`)
      const data = await resp.json()
      message.success('已归档为 Wiki 页面')
      navigate(`/wiki/${data.page_id}`)
    } catch {
      message.error('归档失败，请重试')
    } finally {
      setArchiving(false)
    }
  }

  const handleSearch = async (question: string) => {
    if (!question.trim()) return
    setLastQuestion(question)
    setLoading(true)
    try {
      const resp = await fetch('/api/search/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`)
      const data = await resp.json()
      setResult(data)
    } catch {
      setResult({ answer: '查询失败，请检查后端服务是否运行。', citations: [] })
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSearch = async (keyword: string) => {
    if (!keyword.trim()) return
    setQuickLoading(true)
    try {
      const resp = await fetch('/api/search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: keyword, top_k: 10 }),
      })
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`)
      const data = await resp.json()
      setQuickResults(data)
    } catch {
      message.error('搜索失败，请检查后端服务')
      setQuickResults([])
    } finally {
      setQuickLoading(false)
    }
  }

  const quickSearchTab = (
    <div>
      <Search
        placeholder="输入关键词搜索 Wiki 页面"
        enterButton="搜索"
        size="large"
        prefix={<SearchOutlined />}
        onSearch={handleQuickSearch}
        loading={quickLoading}
        style={{ marginBottom: 24 }}
      />

      {quickLoading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {quickResults.length > 0 && !quickLoading && (
        <List
          dataSource={quickResults}
          renderItem={(item) => {
            const category = item.page_id.split('/')[0]
            return (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/wiki/${item.page_id}`)}
              >
                <List.Item.Meta
                  title={
                    <span>
                      {item.title}
                      <Tag
                        color={CATEGORY_COLORS[category] || '#999'}
                        style={{ marginLeft: 8 }}
                      >
                        {category}
                      </Tag>
                      <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
                        {Math.round(item.score * 100)}%
                      </span>
                    </span>
                  }
                  description={
                    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, color: '#666' }}>
                      {item.snippet}
                    </Paragraph>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}

      {quickResults.length === 0 && !quickLoading && (
        <Empty description="输入关键词开始搜索" style={{ marginTop: 60 }} />
      )}
    </div>
  )

  const qaTab = (
    <div>
      <Search
        placeholder="输入你的问题，例如：关于 Transformer 的核心贡献是什么？"
        enterButton="提问"
        size="large"
        prefix={<SearchOutlined />}
        onSearch={handleSearch}
        loading={loading}
        style={{ marginBottom: 24 }}
      />

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="正在检索和思考..." />
        </div>
      )}

      {result && !loading && (
        <Card>
          <div className="wiki-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.answer}
            </ReactMarkdown>
          </div>

          {result.citations.length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
              <Paragraph type="secondary" strong>
                引用来源：
              </Paragraph>
              <List
                size="small"
                dataSource={result.citations}
                renderItem={(c) => (
                  <List.Item>
                    <a
                      href={`/wiki/${c}`}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate(`/wiki/${c}`)
                      }}
                    >
                      {c}
                    </a>
                  </List.Item>
                )}
              />
            </div>
          )}

          {result.suggested_page && (
            <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={archiving}
                onClick={() => handleArchive(result.suggested_page!)}
              >
                归档为 Wiki 页面：{result.suggested_page.title}
              </Button>
              <Paragraph type="secondary" style={{ marginTop: 4, fontSize: 12 }}>
                分类：{result.suggested_page.category}
              </Paragraph>
            </div>
          )}
        </Card>
      )}

      {!result && !loading && (
        <Empty description="输入问题开始搜索" style={{ marginTop: 60 }} />
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>搜索</Title>
      <Tabs
        defaultActiveKey="quick"
        items={[
          { key: 'quick', label: '快速搜索', children: quickSearchTab },
          { key: 'qa', label: 'AI 问答', children: qaTab },
        ]}
      />
    </div>
  )
}
