import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Menu, Typography, Spin, Empty } from 'antd'
import {
  UserOutlined,
  BulbOutlined,
  TagsOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MenuProps } from 'antd'

const { Sider, Content } = Layout
const { Title } = Typography

const categoryIcons: Record<string, React.ReactNode> = {
  entities: <UserOutlined />,
  concepts: <BulbOutlined />,
  topics: <TagsOutlined />,
  sources: <FileTextOutlined />,
}

const categoryNames: Record<string, string> = {
  entities: '实体',
  concepts: '概念',
  topics: '主题',
  sources: '文档',
}

interface WikiTreeItem {
  category: string
  pages: { page_id: string; title: string; category: string }[]
}

export default function WikiPage() {
  const { category, pageName } = useParams()
  const navigate = useNavigate()
  const [tree, setTree] = useState<WikiTreeItem[]>([])
  const [pageContent, setPageContent] = useState<string>('')
  const [pageTitle, setPageTitle] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Load wiki tree
  useEffect(() => {
    fetch('/api/wiki/tree')
      .then((r) => r.json())
      .then(setTree)
      .catch(() => {})
  }, [])

  // Load page content
  useEffect(() => {
    if (category && pageName) {
      setLoading(true)
      fetch(`/api/wiki/page/${category}/${pageName}`)
        .then((r) => r.json())
        .then((data) => {
          setPageContent(data.content || '')
          setPageTitle(data.title || pageName)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      // Show index
      fetch('/api/wiki/index')
        .then((r) => r.json())
        .then((data) => {
          setPageContent(data.content || '')
          setPageTitle('知识目录')
        })
        .catch(() => {})
    }
  }, [category, pageName])

  // Build menu items
  const menuItems: MenuProps['items'] = tree.map((t) => ({
    key: t.category,
    icon: categoryIcons[t.category],
    label: `${categoryNames[t.category] || t.category}(${t.pages.length})`,
    children: t.pages.map((p) => ({
      key: p.page_id,
      label: p.title,
    })),
  }))

  const selectedKey = category && pageName ? `${category}/${pageName}` : ''

  // Strip frontmatter from content for display
  const displayContent = pageContent.replace(/^---[\s\S]*?---\n*/, '')

  return (
    <Layout style={{ background: '#fff', borderRadius: 8, minHeight: '70vh' }}>
      <Sider
        width={260}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '16px 16px 8px', fontWeight: 600, fontSize: 16 }}>
          Wiki 目录
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={tree.map((t) => t.category)}
          items={menuItems}
          onClick={({ key }) => navigate(`/wiki/${key}`)}
          style={{ border: 'none' }}
        />
      </Sider>
      <Content style={{ padding: '24px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : pageContent ? (
          <div className="wiki-content">
            <Title level={2}>{pageTitle}</Title>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  // Handle [[wikilink]] style links
                  const wikiMatch = String(children).match(
                    /^\[\[(.+?)\]\]$/
                  )
                  if (wikiMatch) {
                    const target = wikiMatch[1]
                    return (
                      <a
                        href={`/wiki/${target}`}
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(`/wiki/${target}`)
                        }}
                      >
                        {target.split('/').pop()}
                      </a>
                    )
                  }
                  if (href?.startsWith('/wiki/')) {
                    return (
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(href)
                        }}
                      >
                        {children}
                      </a>
                    )
                  }
                  return <a href={href}>{children}</a>
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        ) : (
          <Empty description="选择左侧页面查看内容" />
        )}
      </Content>
    </Layout>
  )
}
