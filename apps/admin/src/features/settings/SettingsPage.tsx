import type {
  AdminRegistrationSettingRead,
  AdminSiteSettingRead,
  SiteSettingPatchIn,
} from "@pinjie/api-client";
import {
  CloudUploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Flex,
  Form,
  Image,
  Input,
  Result,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
  Upload,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import { PageFrame, QueryState, formatTime } from "@/components/PageFrame";
import { StandardConfirmModal } from "@/components/StandardConfirmModal";
import { canAccess, useCurrentAdmin } from "@/features/auth";
import { adminApi } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/http";

type SiteFormValues = Pick<SiteSettingPatchIn, "name" | "title" | "keywords" | "description">;
type RegistrationFormValues = { enabled: boolean };

const SITE_QUERY_KEY = ["settings", "site"] as const;
const REGISTRATION_QUERY_KEY = ["settings", "registration"] as const;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isRevisionConflict(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 412 || error.code === "SETTINGS_REVISION_MISMATCH");
}

function SettingMeta({
  data,
}: {
  data:
    | Pick<AdminSiteSettingRead, "updated_at" | "updated_by">
    | Pick<AdminRegistrationSettingRead, "updated_at" | "updated_by">;
}) {
  return (
    <Typography.Text type="secondary" className="settings-meta">
      最近更新：{formatTime(data.updated_at)}
      {data.updated_by ? ` · ${data.updated_by.display_name ?? data.updated_by.id}` : ""}
    </Typography.Text>
  );
}

function RevisionConflict({ onReload }: { onReload: () => void }) {
  return (
    <Alert
      showIcon
      type="warning"
      title="设置已被其他管理员修改"
      description="当前表单内容已保留。加载最新配置会覆盖这些未提交内容。"
      action={<Button icon={<ReloadOutlined />} onClick={onReload}>加载最新配置</Button>}
    />
  );
}

function SiteSettingsTab({ canUpdate }: { canUpdate: boolean }) {
  const [form] = Form.useForm<SiteFormValues>();
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [hydratedRevision, setHydratedRevision] = useState<number>();
  const [deleteLogoRevision, setDeleteLogoRevision] = useState<number>();
  const [conflict, setConflict] = useState(false);
  const query = useQuery({ queryKey: SITE_QUERY_KEY, queryFn: adminApi.siteSetting });

  const hydrate = (data: AdminSiteSettingRead) => {
    form.setFieldsValue({
      name: data.name,
      title: data.title,
      keywords: data.keywords,
      description: data.description,
    });
    setHydratedRevision(data.revision);
    setDirty(false);
    setConflict(false);
  };

  useEffect(() => {
    if (query.data && hydratedRevision === undefined) hydrate(query.data);
  }, [query.data, hydratedRevision]);

  const acceptSavedForm = (data: AdminSiteSettingRead) => {
    queryClient.setQueryData(SITE_QUERY_KEY, data);
    hydrate(data);
  };

  const save = useMutation({
    mutationFn: (values: SiteFormValues) => {
      if (!query.data) throw new Error("站点设置尚未加载");
      return adminApi.updateSiteSetting({ ...values, revision: query.data.revision });
    },
    onSuccess: (data) => {
      acceptSavedForm(data);
      message.success("站点设置已保存");
    },
    onError: (error) => {
      if (isRevisionConflict(error)) setConflict(true);
      else message.error(errorMessage(error));
    },
  });

  const uploadLogo = useMutation({
    mutationFn: (file: globalThis.File) => {
      if (!query.data) throw new Error("站点设置尚未加载");
      return adminApi.uploadSiteLogo(file, query.data.revision);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SITE_QUERY_KEY, data);
      setConflict(false);
      message.success("站点 LOGO 已更新");
    },
    onError: (error) => {
      if (isRevisionConflict(error)) setConflict(true);
      else message.error(errorMessage(error));
    },
  });

  const deleteLogo = useMutation({
    mutationFn: (revision: number) => adminApi.deleteSiteLogo(revision),
    onSuccess: (data) => {
      queryClient.setQueryData(SITE_QUERY_KEY, data);
      setDeleteLogoRevision(undefined);
      setConflict(false);
      message.success("站点 LOGO 已移除");
    },
    onError: (error) => {
      if (isRevisionConflict(error)) setConflict(true);
      else message.error(errorMessage(error));
    },
  });

  const loadLatest = async () => {
    const result = await query.refetch();
    if (result.data) hydrate(result.data);
  };

  const beforeUpload = (file: globalThis.File) => {
    if (!LOGO_TYPES.has(file.type)) {
      message.error("仅支持 PNG、JPEG 或 WebP 图片");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error("站点 LOGO 不能超过 2 MB");
      return Upload.LIST_IGNORE;
    }
    uploadLogo.mutate(file);
    return Upload.LIST_IGNORE;
  };

  const pending = save.isPending || uploadLogo.isPending || deleteLogo.isPending;

  return (
    <>
      <QueryState
        loading={query.isLoading}
        error={query.error ? errorMessage(query.error) : undefined}
        onRetry={() => void query.refetch()}
      />
      {!query.isLoading && !query.error && query.data ? (
        <div className="settings-form-shell">
          {!canUpdate && <Alert showIcon type="info" title="当前账号只有查看权限，设置内容不可修改。" />}
          {conflict && <RevisionConflict onReload={() => void loadLatest()} />}
          <section className="settings-section" aria-labelledby="site-logo-heading">
            <div className="settings-section-heading">
              <Typography.Title id="site-logo-heading" level={4}>站点 LOGO</Typography.Title>
              <Typography.Paragraph type="secondary">用于 Web 公共站点，支持 PNG、JPEG、WebP，最大 2 MB。</Typography.Paragraph>
            </div>
            <Flex align="center" gap={20} wrap="wrap">
              <div className="site-logo-preview">
                {query.data.logo ? (
                  <Image src={query.data.logo.url} alt="当前站点 LOGO" preview={false} />
                ) : (
                  <Typography.Text type="secondary">未上传</Typography.Text>
                )}
              </div>
              <Space wrap>
                <Upload
                  accept="image/png,image/jpeg,image/webp"
                  beforeUpload={beforeUpload}
                  showUploadList={false}
                  disabled={!canUpdate || pending || conflict}
                >
                  <Button icon={<CloudUploadOutlined />} loading={uploadLogo.isPending} disabled={!canUpdate || conflict}>
                    上传 LOGO
                  </Button>
                </Upload>
                {query.data.logo && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteLogo.isPending}
                    disabled={!canUpdate || pending || conflict}
                    onClick={() => setDeleteLogoRevision(query.data.revision)}
                  >
                    移除
                  </Button>
                )}
              </Space>
            </Flex>
          </section>
          <Form
            form={form}
            layout="vertical"
            className="settings-form"
            disabled={!canUpdate || pending}
            onFieldsChange={() => setDirty(true)}
            onFinish={(values) => save.mutate(values)}
          >
            <Form.Item
              label="站点名称"
              name="name"
              rules={[{ required: true, whitespace: true, message: "请输入站点名称" }, { max: 100 }]}
            >
              <Input showCount maxLength={100} placeholder="例如：品界" />
            </Form.Item>
            <Form.Item
              label="站点标题"
              name="title"
              rules={[{ required: true, whitespace: true, message: "请输入站点标题" }, { max: 150 }]}
            >
              <Input showCount maxLength={150} placeholder="用于浏览器标题与搜索结果" />
            </Form.Item>
            <Form.Item
              label="站点关键词"
              name="keywords"
              extra="最多 20 项，每项最多 64 个字符。"
              rules={[{
                validator: (_, values: string[] | undefined) =>
                  values?.some((value) => value.trim().length > 64)
                    ? Promise.reject(new Error("每个关键词最多 64 个字符"))
                    : Promise.resolve(),
              }]}
            >
              <Select
                mode="tags"
                tokenSeparators={[",", "，"]}
                maxCount={20}
                maxTagTextLength={64}
                placeholder="输入关键词后按回车"
                options={[]}
              />
            </Form.Item>
            <Form.Item label="站点描述" name="description" rules={[{ max: 500 }]}>
              <Input.TextArea
                showCount
                maxLength={500}
                autoSize={{ minRows: 4, maxRows: 8 }}
                placeholder="概括站点提供的服务和内容"
              />
            </Form.Item>
            <Flex align="center" justify="space-between" gap={16} wrap="wrap">
              <SettingMeta data={query.data} />
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={save.isPending}
                disabled={!canUpdate || pending || !dirty || conflict}
              >
                保存设置
              </Button>
            </Flex>
          </Form>
        </div>
      ) : null}
      <StandardConfirmModal
        title="确认移除站点 LOGO"
        description="已保存的站点 LOGO 将被删除，Web 将不再显示该图片。需要恢复时请重新上传。"
        open={deleteLogoRevision !== undefined}
        loading={deleteLogo.isPending}
        onCancel={() => setDeleteLogoRevision(undefined)}
        onConfirm={async () => {
          if (deleteLogoRevision === undefined) return;
          await deleteLogo.mutateAsync(deleteLogoRevision);
        }}
      />
    </>
  );
}

function RegistrationSettingsTab({ canUpdate }: { canUpdate: boolean }) {
  const [form] = Form.useForm<RegistrationFormValues>();
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const query = useQuery({ queryKey: REGISTRATION_QUERY_KEY, queryFn: adminApi.registrationSetting });

  useEffect(() => {
    if (query.data && !dirty) form.setFieldsValue({ enabled: query.data.enabled });
  }, [query.data, dirty, form]);

  const save = useMutation({
    mutationFn: (values: RegistrationFormValues) => {
      if (!query.data) throw new Error("注册设置尚未加载");
      return adminApi.updateRegistrationSetting({ revision: query.data.revision, enabled: values.enabled });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(REGISTRATION_QUERY_KEY, data);
      form.setFieldsValue({ enabled: data.enabled });
      setDirty(false);
      setConflict(false);
      message.success("注册设置已保存");
    },
    onError: (error) => {
      if (isRevisionConflict(error)) setConflict(true);
      else message.error(errorMessage(error));
    },
  });

  const loadLatest = async () => {
    const result = await query.refetch();
    if (result.data) {
      form.setFieldsValue({ enabled: result.data.enabled });
      setDirty(false);
      setConflict(false);
    }
  };

  return (
    <>
      <QueryState
        loading={query.isLoading}
        error={query.error ? errorMessage(query.error) : undefined}
        onRetry={() => void query.refetch()}
      />
      {!query.isLoading && !query.error && query.data ? (
        <div className="settings-form-shell">
          {!canUpdate && <Alert showIcon type="info" title="当前账号只有查看权限，注册开关不可修改。" />}
          {conflict && <RevisionConflict onReload={() => void loadLatest()} />}
          <Form
            form={form}
            layout="vertical"
            className="settings-form"
            disabled={!canUpdate || save.isPending}
            onFieldsChange={() => setDirty(true)}
            onFinish={(values) => save.mutate(values)}
          >
            <Form.Item label="开放用户注册" name="enabled" valuePropName="checked">
              <Switch checkedChildren="已开放" unCheckedChildren="已关闭" />
            </Form.Item>
            <Alert
              showIcon
              type="warning"
              title="关闭后，Web 将隐藏注册入口并拒绝新的公开注册请求。Admin 创建用户不受影响。"
            />
            <Flex align="center" justify="space-between" gap={16} wrap="wrap">
              <SettingMeta data={query.data} />
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={save.isPending}
                disabled={!canUpdate || !dirty || conflict}
              >
                保存设置
              </Button>
            </Flex>
          </Form>
        </div>
      ) : null}
    </>
  );
}

export function SettingsPage() {
  const admin = useCurrentAdmin();
  const canReadSite = canAccess(admin, "settings:site:read");
  const canReadRegistration = canAccess(admin, "settings:registration:read");
  const items = useMemo(
    () => [
      ...(canReadSite
        ? [{ key: "site", label: "站点设置", children: <SiteSettingsTab canUpdate={canAccess(admin, "settings:site:update")} /> }]
        : []),
      ...(canReadRegistration
        ? [{ key: "registration", label: "注册设置", children: <RegistrationSettingsTab canUpdate={canAccess(admin, "settings:registration:update")} /> }]
        : []),
    ],
    [admin, canReadRegistration, canReadSite],
  );

  if (items.length === 0) {
    return <Result status="403" title="无权访问系统设置" subTitle="请联系超级管理员分配设置查看权限。" />;
  }

  return (
    <PageFrame title="系统设置" description="管理 Web 公共站点资料与用户注册策略。Admin 控制台品牌保持独立。">
      <Tabs items={items} destroyOnHidden={false} />
    </PageFrame>
  );
}

export default SettingsPage;
