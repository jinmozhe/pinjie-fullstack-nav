import type { NavBulkIn, NavSiteIn, NavSiteRead, PageResultNavSiteRead } from "@pinjie/api-client";
import { PlusOutlined, EditOutlined, DeleteOutlined, UndoOutlined, KeyOutlined, CheckOutlined, StopOutlined, GlobalOutlined, CloudDownloadOutlined, ClearOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Avatar, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag, Tooltip, Image, message } from "antd";
import { useEffect, useRef, useState, type Key } from "react";
import { ImageUploader } from "@/components/Uploader";
import { QueryState } from "@/components/PageFrame";
import { StandardConfirmModal } from "@/components/StandardConfirmModal";
import { canAccess, useCurrentAdmin } from "@/features/auth";
import { navigationApi } from "@/lib/api/navigation";
import { adminApi } from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/http";
import { AccountsDrawer } from "./AccountsDrawer";

export function SitesManager({ deleted }: { deleted: boolean }) {
  const admin = useCurrentAdmin();
  const writable = canAccess(admin, "navigation:write");
  const canPurge = deleted && canAccess(admin, "navigation:purge");
  const canReadCredentials = canAccess(admin, "navigation:credentials:read");
  const actionCount = Number(canReadCredentials) + (writable ? (deleted ? 1 : 3) : 0) + Number(canPurge);
  const actionColumnWidth = Math.max(64, actionCount * 32 + Math.max(0, actionCount - 1) * 8 + 32);
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>();
  const [tagId, setTagId] = useState<string>();
  const [selected, setSelected] = useState<Key[]>([]);
  const [deleting, setDeleting] = useState<{ kind: "soft" | "purge"; ids: string[] }>();
  const [editing, setEditing] = useState<NavSiteRead | null>();
  const [accounts, setAccounts] = useState<NavSiteRead>();
  const [icon, setIcon] = useState<string>();
  const [fetchedIcon, setFetchedIcon] = useState<string>();
  const [iconUploading, setIconUploading] = useState(false);
  const [fetchNotice, setFetchNotice] = useState<{ type: "error" | "warning" | "success"; text: string }>();
  const fetchController = useRef<globalThis.AbortController | null>(null);
  const formVersion = useRef(0);
  const iconVersion = useRef(0);
  const [form] = Form.useForm<NavSiteIn>();
  const metadata = useMutation({ mutationFn: ({ url, signal }: { url: string; signal: globalThis.AbortSignal }) => navigationApi.metadata(url, signal), retry: false, gcTime: 0 });
  useEffect(() => () => { fetchController.current?.abort(); }, []);
  const cancelFetch = () => { fetchController.current?.abort(); fetchController.current = null; setFetchNotice(undefined); };
  const closeEditor = () => { cancelFetch(); formVersion.current += 1; setFetchedIcon(undefined); setEditing(undefined); };
  const query = useQuery({ queryKey: ["navigation", "sites", page, search, deleted, categoryId, tagId], queryFn: () => navigationApi.sites(page, search, deleted, categoryId, tagId) });
  const categories = useQuery({ queryKey: ["navigation", "categories"], queryFn: () => navigationApi.taxonomy("categories") });
  const tags = useQuery({ queryKey: ["navigation", "tags"], queryFn: () => navigationApi.taxonomy("tags") });
  const refresh = () => { setSelected([]); void client.invalidateQueries({ queryKey: ["navigation"] }); };
  const save = useMutation({ mutationFn: async (input: NavSiteIn) => {
    if (fetchedIcon) {
      const bytes = Uint8Array.from(window.atob(fetchedIcon), char => char.charCodeAt(0));
      const asset = await adminApi.uploadAsset(new globalThis.File([bytes], "site-icon.png", { type: "image/png" }), "navigation_icon");
      input = { ...input, icon_asset_id: asset.id };
      form.setFieldValue("icon_asset_id", asset.id);
      setIcon(asset.url); setFetchedIcon(undefined);
    }
    return navigationApi.saveSite(input, editing?.id);
  }, retry: false, onSuccess: () => { closeEditor(); refresh(); message.success("已保存"); }, onError: (error) => message.error(errorMessage(error)) });
  const pin = useMutation({
    mutationKey: ["navigation", "pin-site"],
    mutationFn: (row: NavSiteRead) => navigationApi.saveSite({
      name: row.name, url: row.url, description: row.description,
      category_id: row.category_id, tag_ids: row.tags.map((tag) => tag.id),
      icon_asset_id: row.icon_asset_id, sort_order: row.sort_order,
      is_published: row.is_published, is_pinned: !row.is_pinned,
    }, row.id),
    retry: false,
    onSuccess: async (site) => {
      await client.cancelQueries({ queryKey: ["navigation", "sites"] });
      client.setQueriesData<PageResultNavSiteRead>({ queryKey: ["navigation", "sites"] }, (data) => data && {
        ...data, items: data.items.map((row) => row.id === site.id ? site : row),
      });
      message.success(site.is_pinned ? "已置顶" : "已取消置顶");
      await client.invalidateQueries({ queryKey: ["navigation"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  const pinning = useMutationState({
    filters: { mutationKey: ["navigation", "pin-site"], status: "pending" },
    select: (mutation) => mutation.state.variables as NavSiteRead,
  });
  const isPinning = (id: string) => pinning.some((row) => row.id === id);
  const bulk = useMutation({ mutationFn: navigationApi.bulkSites, onSuccess: () => { refresh(); message.success("操作完成"); }, onError: (error) => message.error(errorMessage(error)) });
  const purge = useMutation({
    mutationFn: navigationApi.purgeSites,
    retry: false,
    onSuccess: (result, input) => {
      setAccounts((current) => current && input.ids.includes(current.id) ? undefined : current);
      for (const id of input.ids) {
        void client.cancelQueries({ queryKey: ["navigation-accounts", id] });
        client.removeQueries({ queryKey: ["navigation-accounts", id] });
      }
      refresh();
      message.success(`已永久删除 ${result.completed_count} 个站点`);
    },
  });
  const busy = bulk.isPending || purge.isPending;
  const selectedPinning = selected.some((id) => isPinning(String(id)));
  useEffect(() => {
    if (query.isSuccess && !query.isFetching && page > Math.max(1, query.data.total_pages)) {
      setPage(Math.max(1, query.data.total_pages));
      setSelected([]);
    }
  }, [page, query.isSuccess, query.isFetching, query.data]);
  const edit = (row: NavSiteRead | null) => { cancelFetch(); formVersion.current += 1; iconVersion.current += 1; setIconUploading(false); setFetchedIcon(undefined); form.resetFields(); form.setFieldsValue(row ?? { name: "", url: "", description: "", category_id: null, tag_ids: [], icon_asset_id: null, sort_order: 0, is_published: false, is_pinned: false }); setIcon(row?.icon_url ?? undefined); setEditing(row); };
  const fetchMetadata = async () => {
    if (metadata.isPending || save.isPending || iconUploading) return;
    try { await form.validateFields(["url"]); } catch { return; }
    cancelFetch();
    const controller = new globalThis.AbortController();
    fetchController.current = controller;
    const version = formVersion.current;
    const previousIcon = iconVersion.current;
    const snapshot = form.getFieldsValue();
    try {
      const result = await metadata.mutateAsync({ url: snapshot.url.trim(), signal: controller.signal });
      if (controller.signal.aborted || version !== formVersion.current || form.getFieldValue("url") !== snapshot.url) return;
      let filled = 0;
      for (const field of ["name", "description"] as const) {
        if (result[field] && form.getFieldValue(field) === snapshot[field]) { form.setFieldValue(field, result[field]); filled += 1; }
      }
      if (result.icon_base64 && iconVersion.current === previousIcon) {
        setFetchedIcon(result.icon_base64); setIcon(`data:image/png;base64,${result.icon_base64}`); filled += 1;
      }
      const warnings = result.warnings ?? [];
      setFetchNotice({ type: warnings.length ? "warning" : "success", text: [`已填入 ${filled} 项`, ...warnings].join("；") });
    } catch (error) {
      if (!controller.signal.aborted && version === formVersion.current) setFetchNotice({ type: "error", text: errorMessage(error) });
    } finally {
      if (fetchController.current === controller) fetchController.current = null;
    }
  };
  const editorVersion = formVersion.current;
  const act = (action: NavBulkIn["action"], ids = selected.map(String)) => {
    if (busy || ids.some(isPinning)) return;
    if (action === "delete") setDeleting({ kind: "soft", ids: [...ids] });
    else bulk.mutate({ ids, action });
  };
  const columns: ProColumns<NavSiteRead>[] = [
    { title: "LOGO", dataIndex: "icon_url", width: 80, align: "center", render: (_, row) => <Avatar className="site-logo" shape="square" size={40} src={row.icon_url || undefined} alt={`${row.name} LOGO`} aria-label={`${row.name} LOGO`} icon={<GlobalOutlined />} /> },
    { title: "站点", dataIndex: "name", width: 220, ellipsis: true, render: (_, row) => <a href={row.url} target="_blank" rel="noopener noreferrer">{row.name}</a> },
    { title: "分类", width: 140, render: (_, row) => row.category?.name ?? "未分类", ellipsis: true },
    { title: "网址", dataIndex: "url", ellipsis: true, render: (_, row) => <a href={row.url} title={row.url} target="_blank" rel="noopener noreferrer">{row.url}</a> },
    { title: "标签", render: (_, row) => row.tags.map((tag) => tag.name).join("、"), ellipsis: true },
    { title: "排序", dataIndex: "sort_order", width: 80 },
    { title: "置顶", dataIndex: "is_pinned", width: 80, render: (_, row) => writable && !deleted && !row.deleted_at ? <Tooltip title={row.is_pinned ? "取消置顶" : "设为置顶"}>
      <Switch checked={row.is_pinned === true} checkedChildren="开" unCheckedChildren="关" aria-label={`${row.name}置顶`}
        loading={isPinning(row.id)} disabled={busy || save.isPending || editing !== undefined || Boolean(deleting)}
        onChange={() => { if (!isPinning(row.id)) pin.mutate(row); }} />
    </Tooltip> : row.is_pinned ? <Tag color="orange">已置顶</Tag> : "未置顶" },
    { title: "状态", width: 100, render: (_, row) => <Tag color={row.is_published ? "green" : "default"}>{row.deleted_at ? "回收站" : row.is_published ? "已发布" : "未发布"}</Tag> },
    { title: "操作", width: actionColumnWidth, render: (_, row) => <Space size={8} wrap={false}>
      {canReadCredentials && <Tooltip title="帐号资料"><Button icon={<KeyOutlined />} onClick={() => setAccounts(row)} /></Tooltip>}
      {writable && (deleted ? <Tooltip title="恢复为未发布"><Button disabled={busy} loading={bulk.isPending} icon={<UndoOutlined />} onClick={() => act("restore", [row.id])} /></Tooltip> : <>
        <Tooltip title="编辑站点"><Button disabled={isPinning(row.id)} icon={<EditOutlined />} onClick={() => edit(row)} /></Tooltip>
        <Tooltip title={row.is_published ? "下架" : "发布"}><Button disabled={isPinning(row.id)} loading={bulk.isPending} icon={row.is_published ? <StopOutlined /> : <CheckOutlined />} onClick={() => act(row.is_published ? "unpublish" : "publish", [row.id])} /></Tooltip>
        <Tooltip title="移入回收站"><Button danger disabled={isPinning(row.id)} loading={bulk.isPending} icon={<DeleteOutlined />} onClick={() => act("delete", [row.id])} /></Tooltip>
      </>)}
      {canPurge && <Tooltip title="永久删除"><Button danger aria-label="永久删除" disabled={busy} icon={<DeleteOutlined />} onClick={() => setDeleting({ kind: "purge", ids: [row.id] })} /></Tooltip>}
    </Space> },
  ];
  return <>
    <QueryState loading={false} error={categories.isError || tags.isError ? "分类或标签筛选选项加载失败" : undefined} onRetry={() => { void categories.refetch(); void tags.refetch(); }} />
    <QueryState loading={false} error={query.isError ? errorMessage(query.error) : undefined} onRetry={() => void query.refetch()} />
    <ProTable<NavSiteRead> className="responsive-data-table site-data-table" rowKey="id" headerTitle="站点列表" columns={columns} dataSource={query.data?.items} loading={query.isPending} search={false} options={{ reload: () => void query.refetch() }} tableLayout="fixed" scroll={{ x: 1100 }}
      pagination={{ current: page, pageSize: 20, total: query.data?.total, showSizeChanger: false, onChange: (value) => { setPage(value); setSelected([]); } }}
      rowSelection={writable || canPurge ? { selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: (row) => ({ disabled: busy || isPinning(row.id) }) } : false}
      toolBarRender={() => [
        <div key="site-toolbar" className="responsive-table-toolbar site-table-toolbar">
          <div className="site-table-filters">
            <Select className="site-table-filter" aria-label="按分类筛选" placeholder="全部分类" value={categoryId} allowClear showSearch optionFilterProp="label"
              loading={categories.isPending || categories.isFetching} disabled={categories.isPending || categories.isError}
              options={categories.data?.map((item) => ({ label: `${item.name}${item.is_active === false ? "（停用）" : ""}`, value: item.id }))}
              onChange={(value: string | undefined) => { setCategoryId(value); setPage(1); setSelected([]); }} />
            <Select className="site-table-filter" aria-label="按标签筛选" placeholder="全部标签" value={tagId} allowClear showSearch optionFilterProp="label"
              loading={tags.isPending || tags.isFetching} disabled={tags.isPending || tags.isError}
              options={tags.data?.map((item) => ({ label: `${item.name}${item.is_active === false ? "（停用）" : ""}`, value: item.id }))}
              onChange={(value: string | undefined) => { setTagId(value); setPage(1); setSelected([]); }} />
            <Tooltip title="清空筛选"><Button aria-label="清空筛选" icon={<ClearOutlined />} disabled={!categoryId && !tagId} onClick={() => { setCategoryId(undefined); setTagId(undefined); setPage(1); setSelected([]); }} /></Tooltip>
          </div>
          <div className="site-table-search-actions">
            <Input.Search className="site-table-search" aria-label="搜索站点名称或域名" placeholder="搜索名称或域名" allowClear maxLength={100} onSearch={(value) => { setSearch(value); setPage(1); setSelected([]); }} />
            {writable && !deleted && <Button type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>新增站点</Button>}
          </div>
        </div>,
      ]}
      tableAlertOptionRender={() => <Space>{deleted ? <>
        {writable && <Button icon={<UndoOutlined />} disabled={busy} loading={bulk.isPending} onClick={() => act("restore")}>恢复</Button>}
        {canPurge && <Button danger icon={<DeleteOutlined />} disabled={busy} onClick={() => setDeleting({ kind: "purge", ids: selected.map(String) })}>永久删除</Button>}
      </> : <><Button disabled={selectedPinning} icon={<CheckOutlined />} loading={bulk.isPending} onClick={() => act("publish")}>发布</Button><Button disabled={selectedPinning} icon={<StopOutlined />} loading={bulk.isPending} onClick={() => act("unpublish")}>下架</Button><Button danger disabled={selectedPinning} icon={<DeleteOutlined />} loading={bulk.isPending} onClick={() => act("delete")}>移入回收站</Button></>}</Space>} />
    <Modal title={editing ? "编辑站点" : "新增站点"} open={editing !== undefined} onCancel={closeEditor} onOk={() => form.submit()} confirmLoading={save.isPending} okButtonProps={{ disabled: metadata.isPending || iconUploading }} cancelButtonProps={{ disabled: save.isPending }} closable={!save.isPending} keyboard={!save.isPending} maskClosable={!save.isPending} destroyOnHidden>
      <QueryState loading={categories.isPending || tags.isPending} error={categories.isError || tags.isError ? "分类或标签加载失败" : undefined} onRetry={() => { void categories.refetch(); void tags.refetch(); }} />
      <Form form={form} layout="vertical" disabled={save.isPending} onValuesChange={(changed) => { if ("url" in changed) cancelFetch(); }} onFinish={(values) => { if (!metadata.isPending && !save.isPending && !iconUploading) save.mutate(values); }}>
        <Form.Item label="网址" required>
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item name="url" noStyle rules={[{ required: true }, { type: "url" }, { validator: (_, value: string) => !value || /^https?:\/\//i.test(value) ? Promise.resolve() : Promise.reject(new Error("请输入 HTTP 或 HTTPS 网址")) }]}><Input aria-label="网址" maxLength={2000} placeholder="https://" /></Form.Item>
            <Button icon={<CloudDownloadOutlined />} loading={metadata.isPending} disabled={iconUploading || save.isPending} onClick={() => void fetchMetadata()}>抓取</Button>
          </Space.Compact>
        </Form.Item>
        {fetchNotice && <Alert showIcon type={fetchNotice.type} title={fetchNotice.text} style={{ marginBottom: 16 }} />}
        <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="category_id" label="分类" extra="可暂不分类；未分类站点不能发布或置顶。"><Select allowClear placeholder="暂不分类" showSearch optionFilterProp="label" options={categories.data?.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
        <Form.Item name="tag_ids" label="标签"><Select mode="multiple" optionFilterProp="label" options={tags.data?.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
        <Form.Item name="description" label="简介"><Input.TextArea maxLength={2000} rows={3} /></Form.Item>
        <Form.Item name="icon_asset_id" hidden><Input /></Form.Item>
        <Form.Item label="图标"><Space wrap>{icon && <Image src={icon} width={40} height={40} alt="站点图标" />}<ImageUploader key={editorVersion} scene="navigation_icon" disabled={save.isPending || metadata.isPending} onUploadingChange={(uploading) => { if (editorVersion === formVersion.current) setIconUploading(uploading); }} onAsset={(asset) => { if (editorVersion !== formVersion.current) return; iconVersion.current += 1; setFetchedIcon(undefined); form.setFieldValue("icon_asset_id", asset.id); setIcon(asset.url); }} /><Tooltip title="移除图标"><Button disabled={iconUploading || save.isPending} icon={<DeleteOutlined />} onClick={() => { iconVersion.current += 1; setFetchedIcon(undefined); form.setFieldValue("icon_asset_id", null); setIcon(undefined); }} /></Tooltip></Space></Form.Item>
        <Form.Item name="sort_order" label="排序"><InputNumber min={-1000000} max={1000000} /></Form.Item>
        <Form.Item name="is_published" label="发布" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="is_pinned" label="置顶" valuePropName="checked" extra="显示在 Web /top 常用站点页，首页顺序保持不变；仍需发布且分类可见。"><Switch /></Form.Item>
      </Form>
    </Modal>
    <StandardConfirmModal
      title={deleting?.kind === "purge" ? "确认永久删除" : "确认移入回收站"}
      description={deleting?.kind === "purge"
        ? `将永久删除选中的 ${deleting.ids.length} 个站点及其全部帐号资料和标签关联。删除后无法通过回收站恢复，分类、标签及图标文件保留。`
        : `将选中的 ${deleting?.ids.length ?? 0} 个站点移入回收站，公开导航将不再显示这些站点。之后可在回收站恢复为未发布状态。`}
      open={Boolean(deleting)}
      loading={busy}
      onCancel={() => setDeleting(undefined)}
      onConfirm={async () => {
        if (!deleting) return;
        if (deleting.kind === "purge") await purge.mutateAsync({ ids: deleting.ids });
        else await bulk.mutateAsync({ ids: deleting.ids, action: "delete" });
        setDeleting(undefined);
      }}
    />
    {accounts && <AccountsDrawer key={accounts.id} site={accounts} onClose={() => setAccounts(undefined)} />}
  </>;
}
