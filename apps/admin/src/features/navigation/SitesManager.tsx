import type { NavBulkIn, NavSiteIn, NavSiteRead } from "@pinjie/api-client";
import { PlusOutlined, EditOutlined, DeleteOutlined, UndoOutlined, KeyOutlined, CheckOutlined, StopOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag, Tooltip, Image, message } from "antd";
import { useState, type Key } from "react";
import { ImageUploader } from "@/components/Uploader";
import { QueryState } from "@/components/PageFrame";
import { canAccess, useCurrentAdmin } from "@/features/auth";
import { navigationApi } from "@/lib/api/navigation";
import { errorMessage } from "@/lib/api/http";
import { AccountsDrawer } from "./AccountsDrawer";

export function SitesManager({ deleted }: { deleted: boolean }) {
  const admin = useCurrentAdmin();
  const writable = canAccess(admin, "navigation:write");
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Key[]>([]);
  const [editing, setEditing] = useState<NavSiteRead | null>();
  const [accounts, setAccounts] = useState<NavSiteRead>();
  const [icon, setIcon] = useState<string>();
  const [form] = Form.useForm<NavSiteIn>();
  const query = useQuery({ queryKey: ["navigation", "sites", page, search, deleted], queryFn: () => navigationApi.sites(page, search, deleted) });
  const categories = useQuery({ queryKey: ["navigation", "categories"], queryFn: () => navigationApi.taxonomy("categories") });
  const tags = useQuery({ queryKey: ["navigation", "tags"], queryFn: () => navigationApi.taxonomy("tags") });
  const refresh = () => { setSelected([]); void client.invalidateQueries({ queryKey: ["navigation"] }); };
  const save = useMutation({ mutationFn: (input: NavSiteIn) => navigationApi.saveSite(input, editing?.id), onSuccess: () => { setEditing(undefined); refresh(); message.success("已保存"); }, onError: (error) => message.error(errorMessage(error)) });
  const bulk = useMutation({ mutationFn: navigationApi.bulkSites, onSuccess: () => { refresh(); message.success("操作完成"); }, onError: (error) => message.error(errorMessage(error)) });
  const edit = (row: NavSiteRead | null) => { form.resetFields(); form.setFieldsValue(row ?? { name: "", url: "", description: "", tag_ids: [], icon_asset_id: null, sort_order: 0, is_published: false }); setIcon(row?.icon_url ?? undefined); setEditing(row); };
  const act = (action: NavBulkIn["action"], ids = selected.map(String)) => bulk.mutate({ ids, action });
  const columns: ProColumns<NavSiteRead>[] = [
    { title: "站点", dataIndex: "name", width: 220, ellipsis: true, render: (_, row) => <a href={row.url} target="_blank" rel="noopener noreferrer">{row.name}</a> },
    { title: "分类", render: (_, row) => row.category.name, ellipsis: true },
    { title: "标签", render: (_, row) => row.tags.map((tag) => tag.name).join("、"), ellipsis: true, width: 160 },
    { title: "排序", dataIndex: "sort_order", width: 80 },
    { title: "状态", render: (_, row) => <Tag color={row.is_published ? "green" : "default"}>{row.deleted_at ? "回收站" : row.is_published ? "已发布" : "未发布"}</Tag> },
    { title: "操作", width: "1%", render: (_, row) => <Space wrap={false}>
      {canAccess(admin, "navigation:credentials:read") && <Tooltip title="帐号资料"><Button icon={<KeyOutlined />} onClick={() => setAccounts(row)} /></Tooltip>}
      {writable && (deleted ? <Tooltip title="恢复为未发布"><Button loading={bulk.isPending} icon={<UndoOutlined />} onClick={() => act("restore", [row.id])} /></Tooltip> : <>
        <Tooltip title="编辑站点"><Button icon={<EditOutlined />} onClick={() => edit(row)} /></Tooltip>
        <Tooltip title={row.is_published ? "下架" : "发布"}><Button loading={bulk.isPending} icon={row.is_published ? <StopOutlined /> : <CheckOutlined />} onClick={() => act(row.is_published ? "unpublish" : "publish", [row.id])} /></Tooltip>
        <Tooltip title="移入回收站"><Button danger loading={bulk.isPending} icon={<DeleteOutlined />} onClick={() => act("delete", [row.id])} /></Tooltip>
      </>)}
    </Space> },
  ];
  return <>
    <QueryState loading={false} error={query.isError ? errorMessage(query.error) : undefined} onRetry={() => void query.refetch()} />
    <ProTable<NavSiteRead> rowKey="id" columns={columns} dataSource={query.data?.items} loading={query.isPending} search={false} options={false} scroll={{ x: "max-content" }}
      pagination={{ current: page, pageSize: 20, total: query.data?.total, showSizeChanger: false, onChange: (value) => { setPage(value); setSelected([]); } }}
      rowSelection={writable ? { selectedRowKeys: selected, onChange: setSelected } : false}
      toolBarRender={() => [<Input.Search key="search" placeholder="搜索站点" allowClear maxLength={100} onSearch={(value) => { setSearch(value); setPage(1); setSelected([]); }} />, ...(writable && !deleted ? [<Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>新增站点</Button>] : [])]}
      tableAlertOptionRender={() => <Space>{deleted ? <Button icon={<UndoOutlined />} loading={bulk.isPending} onClick={() => act("restore")}>恢复</Button> : <><Button icon={<CheckOutlined />} loading={bulk.isPending} onClick={() => act("publish")}>发布</Button><Button icon={<StopOutlined />} loading={bulk.isPending} onClick={() => act("unpublish")}>下架</Button><Button danger icon={<DeleteOutlined />} loading={bulk.isPending} onClick={() => act("delete")}>移入回收站</Button></>}</Space>} />
    <Modal title={editing ? "编辑站点" : "新增站点"} open={editing !== undefined} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <QueryState loading={categories.isPending || tags.isPending} error={categories.isError || tags.isError ? "分类或标签加载失败" : undefined} onRetry={() => { void categories.refetch(); void tags.refetch(); }} />
      <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
        <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="url" label="网址" rules={[{ required: true }, { type: "url" }]}><Input maxLength={2000} placeholder="https://" /></Form.Item>
        <Form.Item name="category_id" label="分类" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={categories.data?.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
        <Form.Item name="tag_ids" label="标签"><Select mode="multiple" optionFilterProp="label" options={tags.data?.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
        <Form.Item name="description" label="简介"><Input.TextArea maxLength={2000} rows={3} /></Form.Item>
        <Form.Item name="icon_asset_id" hidden><Input /></Form.Item>
        <Form.Item label="图标"><Space>{icon && <Image src={icon} width={40} height={40} alt="站点图标" />}<ImageUploader scene="navigation_icon" onAsset={(asset) => { form.setFieldValue("icon_asset_id", asset.id); setIcon(asset.url); }} /><Tooltip title="移除图标"><Button icon={<DeleteOutlined />} onClick={() => { form.setFieldValue("icon_asset_id", null); setIcon(undefined); }} /></Tooltip></Space></Form.Item>
        <Form.Item name="sort_order" label="排序"><InputNumber min={-1000000} max={1000000} /></Form.Item>
        <Form.Item name="is_published" label="发布" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
    {accounts && <AccountsDrawer key={accounts.id} site={accounts} onClose={() => setAccounts(undefined)} />}
  </>;
}
