import type { NavAccountIn, NavAccountRead, NavBulkIn, NavSiteRead } from "@pinjie/api-client";
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, StopOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input, InputNumber, Modal, Space, Switch, Tag, Tooltip, Typography, message } from "antd";
import { useState, type Key } from "react";
import { StandardConfirmModal } from "@/components/StandardConfirmModal";
import { QueryState } from "@/components/PageFrame";
import { canAccess, useCurrentAdmin } from "@/features/auth";
import { navigationApi } from "@/lib/api/navigation";
import { errorMessage } from "@/lib/api/http";

type AccountStatusChange = { id: string; active: boolean };

export function AccountsDrawer({ site, onClose }: { site: NavSiteRead; onClose: () => void }) {
  const writable = canAccess(useCurrentAdmin(), "navigation:credentials:write") && !site.deleted_at;
  const client = useQueryClient();
  const [selected, setSelected] = useState<Key[]>([]);
  const [editing, setEditing] = useState<NavAccountRead | null>();
  const [deleting, setDeleting] = useState<string[]>();
  const [form] = Form.useForm<NavAccountIn>();
  const query = useQuery({ queryKey: ["navigation-accounts", site.id], queryFn: ({ signal }) => navigationApi.accounts(site.id, signal), gcTime: 0, staleTime: 0, retry: false });
  const refresh = () => { setSelected([]); void client.invalidateQueries({ queryKey: ["navigation-accounts", site.id] }); };
  const save = useMutation({ gcTime: 0, mutationFn: (input: NavAccountIn) => navigationApi.saveAccount(site.id, input, editing?.id), onSuccess: () => { form.resetFields(); setEditing(undefined); save.reset(); refresh(); message.success("已保存"); }, onError: (error) => message.error(errorMessage(error)) });
  const bulk = useMutation({ mutationFn: (input: NavBulkIn) => navigationApi.bulkAccounts(site.id, input), onSuccess: () => { setDeleting(undefined); refresh(); message.success("操作完成"); }, onError: (error) => message.error(errorMessage(error)) });
  const status = useMutation({
    mutationKey: ["navigation-account-status", site.id],
    gcTime: 0,
    mutationFn: ({ id, active }: AccountStatusChange) => navigationApi.bulkAccounts(site.id, { ids: [id], action: active ? "enable" : "disable" }),
    retry: false,
    onSuccess: async (_, { active }) => {
      message.success(active ? "已启用" : "已停用");
      await client.invalidateQueries({ queryKey: ["navigation-accounts", site.id] });
    },
    onError: (error) => { message.error(errorMessage(error)); status.reset(); },
  });
  const changing = useMutationState({
    filters: { mutationKey: ["navigation-account-status", site.id], status: "pending" },
    select: (mutation) => mutation.state.variables as AccountStatusChange,
  });
  const isChanging = (id: string) => changing.some((change) => change.id === id);
  const selectedChanging = selected.some((id) => isChanging(String(id)));
  const edit = (row: NavAccountRead | null) => { form.resetFields(); form.setFieldsValue(row ?? { label: "", username: "", password: "", notes: "", sort_order: 0, is_active: true }); setEditing(row); };
  const columns: ProColumns<NavAccountRead>[] = [
    { title: "名称", dataIndex: "label", ellipsis: true, width: 120 },
    { title: "用户名", dataIndex: "username", width: 180, render: (_, row) => <Typography.Text copyable={{ text: row.username }} ellipsis={{ tooltip: row.username }} style={{ maxWidth: 160 }}>{row.username || "-"}</Typography.Text> },
    { title: "密码", dataIndex: "password", width: 180, render: (_, row) => <Typography.Text copyable={{ text: row.password }} ellipsis={{ tooltip: row.password }} style={{ maxWidth: 160, whiteSpace: "pre" }}>{row.password || "-"}</Typography.Text> },
    { title: "备注", dataIndex: "notes", ellipsis: true, width: 180 },
    { title: "状态", render: (_, row) => writable ? <Tooltip title={row.is_active ? "停用" : "启用"}>
      <Switch checked={row.is_active === true} checkedChildren="开" unCheckedChildren="关" aria-label={`${row.label || "帐号"}状态`}
        loading={isChanging(row.id)} disabled={bulk.isPending || save.isPending || editing !== undefined || Boolean(deleting)}
        onChange={(active) => { if (!isChanging(row.id)) status.mutate({ id: row.id, active }); }} />
    </Tooltip> : <Tag color={row.is_active ? "green" : "default"}>{row.is_active ? "启用" : "停用"}</Tag> },
    ...(writable ? [{ title: "操作", width: "1%", render: (_: unknown, row: NavAccountRead) => <Space wrap={false}><Tooltip title="编辑"><Button disabled={isChanging(row.id)} icon={<EditOutlined />} onClick={() => edit(row)} /></Tooltip><Tooltip title="删除"><Button danger disabled={isChanging(row.id)} icon={<DeleteOutlined />} onClick={() => setDeleting([row.id])} /></Tooltip></Space> }] : []),
  ];
  return <Drawer title={`${site.name} · 帐号资料`} open onClose={onClose} size={960} destroyOnHidden>
    <QueryState loading={false} error={query.isError ? errorMessage(query.error) : undefined} onRetry={() => void query.refetch()} />
    <ProTable<NavAccountRead> rowKey="id" headerTitle="帐号列表" dataSource={query.isError ? [] : query.data} columns={columns} loading={query.isPending} search={false} options={{ reload: () => void query.refetch() }} scroll={{ x: "max-content" }} onChange={() => setSelected([])} rowSelection={writable ? { selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: (row) => ({ disabled: bulk.isPending || isChanging(row.id) }) } : false}
      toolBarRender={() => writable ? [<Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>新增帐号</Button>] : []}
      tableAlertOptionRender={() => <Space><Button disabled={selectedChanging} icon={<CheckOutlined />} loading={bulk.isPending} onClick={() => bulk.mutate({ ids: selected.map(String), action: "enable" })}>启用</Button><Button disabled={selectedChanging} icon={<StopOutlined />} loading={bulk.isPending} onClick={() => bulk.mutate({ ids: selected.map(String), action: "disable" })}>停用</Button><Button danger disabled={bulk.isPending || selectedChanging} icon={<DeleteOutlined />} onClick={() => setDeleting(selected.map(String))}>删除</Button></Space>} />
    <Modal aria-label={editing ? "编辑帐号" : "新增帐号"} title={<span id="account-editor-title">{editing ? "编辑帐号" : "新增帐号"}</span>} open={editing !== undefined} onCancel={() => { form.resetFields(); setEditing(undefined); }} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" autoComplete="off" onFinish={(values) => save.mutate(values)}>
        <Form.Item name="label" label="名称"><Input maxLength={100} /></Form.Item>
        <Form.Item name="username" label="用户名"><Input maxLength={500} autoComplete="off" /></Form.Item>
        <Form.Item name="password" label="密码"><Input.TextArea maxLength={10000} rows={2} autoComplete="off" /></Form.Item>
        <Form.Item name="notes" label="备注"><Input.TextArea maxLength={10000} rows={4} /></Form.Item>
        <Form.Item name="sort_order" label="排序"><InputNumber min={-1000000} max={1000000} /></Form.Item>
        <Form.Item name="is_active" label="启用" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
    <StandardConfirmModal title="删除外网帐号" description="选中的帐号、密码和备注将永久删除，无法恢复。" open={Boolean(deleting)} loading={bulk.isPending} onCancel={() => setDeleting(undefined)} onConfirm={async () => { if (deleting) await bulk.mutateAsync({ ids: deleting, action: "delete" }); }} />
  </Drawer>;
}
