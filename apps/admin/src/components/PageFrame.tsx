import { PageContainer } from "@ant-design/pro-components";
import type { ReactNode } from "react";
import { Alert, Button, Card, Empty, Spin, Typography } from "antd";

export function PageFrame({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <PageContainer
      className="workspace-page"
      title={<Typography.Title id="page-heading" className="page-title" level={1}>{title}</Typography.Title>}
      content={description}
      extra={action}
      aria-labelledby="page-heading"
    >
      <Card className="workspace-panel" variant="borderless">
        {children}
      </Card>
    </PageContainer>
  );
}

export function QueryState({ loading, error, empty, onRetry }: { loading: boolean; error?: string; empty?: boolean; onRetry: () => void }) {
  if (loading) return <div className="center-state" role="status" aria-label="正在加载"><Spin /><Typography.Text type="secondary">正在加载</Typography.Text></div>;
  if (error) return <Alert showIcon type="error" title={error} action={<Button onClick={onRetry}>重试</Button>} />;
  if (empty) return <Empty description="暂无数据" />;
  return null;
}

export function formatTime(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}
