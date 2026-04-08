import { useState } from 'react'
import {
  Upload,
  Card,
  Typography,
  Tag,
  Alert,
  Descriptions,
  List,
  message,
} from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'

const { Dragger } = Upload
const { Title } = Typography

interface IngestResult {
  source_id: string
  filename: string
  document_type: string
  topic_tags: string[]
  summary: string
  wiki_pages_created: string[]
  wiki_pages_updated: string[]
}

export default function IngestPage() {
  const [results, setResults] = useState<IngestResult[]>([])
  const [loading, setLoading] = useState(false)

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    action: '/api/ingest',
    accept: '.pdf,.docx,.doc,.pptx,.ppt,.md,.txt',
    showUploadList: true,
    onChange(info) {
      const { status } = info.file
      if (status === 'uploading') {
        setLoading(true)
      }
      if (status === 'done') {
        setLoading(false)
        const result = info.file.response as IngestResult
        setResults((prev) => [result, ...prev])
        message.success(`${info.file.name} 处理完成`)
      } else if (status === 'error') {
        setLoading(false)
        message.error(`${info.file.name} 处理失败`)
      }
    },
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>导入文档</Title>

      <Card style={{ marginBottom: 24 }}>
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域</p>
          <p className="ant-upload-hint">
            支持 PDF / DOCX / PPTX / MD / TXT，系统将自动提取、分类并生成 Wiki 页面
          </p>
        </Dragger>
      </Card>

      {loading && (
        <Alert
          message="正在处理文档..."
          description="系统正在提取内容、分类、生成 Wiki 页面，请稍候"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {results.map((r) => (
        <Card
          key={r.source_id}
          title={r.filename}
          style={{ marginBottom: 16 }}
          size="small"
        >
          <Descriptions column={1} size="small">
            <Descriptions.Item label="文档类型">
              <Tag color="blue">{r.document_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="主题标签">
              {r.topic_tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="摘要">{r.summary}</Descriptions.Item>
          </Descriptions>
          {r.wiki_pages_created.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>生成的 Wiki 页面：</strong>
              <List
                size="small"
                dataSource={r.wiki_pages_created}
                renderItem={(p) => (
                  <List.Item>
                    <a href={`/wiki/${p}`}>{p}</a>
                  </List.Item>
                )}
              />
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
