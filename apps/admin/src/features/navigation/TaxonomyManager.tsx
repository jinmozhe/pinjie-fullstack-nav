import type { NavBulkIn, NavCategoryIn, NavCategoryRead, NavTaxonomyRead } from "@pinjie/api-client";
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, StopOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, InputNumber, Modal, Space, Switch, Tag, Tooltip, message } from "antd";
import { useState, type Key } from "react";
import { StandardConfirmModal } from "@/components/StandardConfirmModal";
import { QueryState } from "@/components/PageFrame";
import { canAccess, useCurrentAdmin } from "@/features/auth";
import { navigationApi, type TaxonomyKind } from "@/lib/api/navigation";
import { errorMessage } from "@/lib/api/http";
import { CategoryIcon, CategoryIconSelect } from "./CategoryIcon";

type TaxonomyRow = NavCategoryRead | NavTaxonomyRead;

export function TaxonomyManager({ kind }: { kind: TaxonomyKind }) {
  const writable = canAccess(useCurrentAdmin(), "navigation:write");
  const client = useQueryClient();
  const [selected, setSelected] = useState<Key[]>([]);
  const [editing, setEditing] = useState<TaxonomyRow | null>();
  const [deleting, setDeleting] = useState<string[]>();
  const [form] = Form.useForm<NavCategoryIn>();
  const query = useQuery({ queryKey: ["navigation", kind], queryFn: () => navigationApi.taxonomy(kind) });
  const refresh = () => { setSelected([]); void client.invalidateQueries({ queryKey: ["navigation"] }); };
  const save = useMutation({ mutationFn: (input: NavCategoryIn) => navigationApi.saveTaxonomy(kind, input, editing?.id), onSuccess: () => { setEditing(undefined); refresh(); message.success("已保存"); }, onError: (error) => message.error(errorMessage(error)) });
  const bulk = useMutation({ mutationFn: (input: NavBulkIn) => navigationApi.bulkTaxonomy(kind, input), onSuccess: () => { setDeleting(undefined); refresh(); message.success("操作完成"); }, onError: (error) => message.error(errorMessage(error)) });
  const edit = (row: TaxonomyRow | null) => { form.resetFields(); form.setFieldsValue(row ?? { name: "", description: "", sort_order: 0, is_active: true, ...(kind === "categories" ? { requires_login: false, icon_key: null } : {}) }); setEditing(row); };
  const columns: ProColumns<TaxonomyRow>[] = [
    ...(kind === "categories" ? [{ title: "图标", dataIndex: "icon_key", width: 64, render: (_: unknown, row: TaxonomyRow) => <CategoryIcon value={"requires_login" in row ? row.icon_key : null} /> }] : []),
    { title: "名称", dataIndex: "name", ellipsis: true },
    { title: "说明", dataIndex: "description", ellipsis: true },
    { title: "排序", dataIndex: "sort_order", width: 80 },
    { title: "状态", dataIndex: "is_active", render: (_, row) => <Tag color={row.is_active ? "green" : "default"}>{row.is_active ? "启用" : "停用"}</Tag> },
    ...(kind === "categories" ? [{ title: "可见范围", render: (_: unknown, row: TaxonomyRow) => <Tag color={"requires_login" in row && row.requires_login ? "blue" : "default"}>{"requires_login" in row && row.requires_login ? "登录可见" : "公开"}</Tag> }] : []),
    ...(writable ? [{ title: "操作", width: "1%", render: (_: unknown, row: NavTaxonomyRead) => <Space wrap={false}><Tooltip title="编辑"><Button icon={<EditOutlined />} onClick={() => edit(row)} /></Tooltip><Tooltip title="删除"><Button danger icon={<DeleteOutlined />} onClick={() => setDeleting([row.id])} /></Tooltip></Space> }] : []),
  ];
  return <>
    <QueryState loading={false} error={query.isError ? errorMessage(query.error) : undefined} onRetry={() => void query.refetch()} />
    <ProTable<TaxonomyRow> rowKey="id" headerTitle={`${kind === "categories" ? "分类" : "标签"}列表`} columns={columns} dataSource={query.data} loading={query.isPending} search={false} options={{ reload: () => void query.refetch() }} scroll={{ x: "max-content" }} onChange={() => setSelected([])}
      rowSelection={writable ? { selectedRowKeys: selected, onChange: setSelected } : false}
      toolBarRender={() => writable ? [<Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>新增{kind === "categories" ? "分类" : "标签"}</Button>] : []}
      tableAlertOptionRender={() => <Space><Button icon={<CheckOutlined />} loading={bulk.isPending} onClick={() => bulk.mutate({ ids: selected.map(String), action: "enable" })}>启用</Button><Button icon={<StopOutlined />} loading={bulk.isPending} onClick={() => bulk.mutate({ ids: selected.map(String), action: "disable" })}>停用</Button><Button danger icon={<DeleteOutlined />} onClick={() => setDeleting(selected.map(String))}>删除</Button></Space>} />
    <Modal title={editing ? "编辑" : "新增"} open={editing !== undefined} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
        <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
        {kind === "categories" && <Form.Item name="icon_key" label="图标"><CategoryIconSelect disabled={save.isPending} /></Form.Item>}
        <Form.Item name="description" label="说明"><Input.TextArea maxLength={1000} rows={3} /></Form.Item>
        <Form.Item name="sort_order" label="排序"><InputNumber min={-1000000} max={1000000} /></Form.Item>
        <Form.Item name="is_active" label="启用" valuePropName="checked"><Switch /></Form.Item>
        {kind === "categories" && <Form.Item name="requires_login" label="仅登录后可见" valuePropName="checked"><Switch /></Form.Item>}
      </Form>
    </Modal>
    <StandardConfirmModal title="删除资料" description={kind === "categories" ? "分类删除后无法恢复；仍有关联站点时会拒绝删除。" : "标签删除后无法恢复，关联站点将解除此标签。"} open={Boolean(deleting)} loading={bulk.isPending} onCancel={() => setDeleting(undefined)} onConfirm={async () => { if (deleting) await bulk.mutateAsync({ ids: deleting, action: "delete" }); }} />
  </>;
}
