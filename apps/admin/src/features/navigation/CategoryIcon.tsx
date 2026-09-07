import type { NavCategoryRead } from "@pinjie/api-client";
import {
  ApiOutlined, AppstoreOutlined, BarChartOutlined, BookOutlined, TrophyOutlined,
  CloudOutlined, CloseCircleOutlined, CodeOutlined, DatabaseOutlined, FolderOutlined, GlobalOutlined,
  MessageOutlined, NotificationOutlined, PictureOutlined, PlayCircleOutlined,
  ReadOutlined, RobotOutlined, SafetyOutlined, ShoppingOutlined, SkinOutlined,
  SoundOutlined, ToolOutlined,
} from "@ant-design/icons";
import { Select, Space, Tooltip } from "antd";

type IconKey = NonNullable<NavCategoryRead["icon_key"]>;

const categoryIcons: Record<IconKey, { label: string; Icon: typeof CodeOutlined }> = {
  code: { label: "开发", Icon: CodeOutlined },
  book: { label: "阅读", Icon: BookOutlined },
  tool: { label: "工具", Icon: ToolOutlined },
  app: { label: "应用", Icon: AppstoreOutlined },
  globe: { label: "网站", Icon: GlobalOutlined },
  cloud: { label: "云服务", Icon: CloudOutlined },
  database: { label: "数据库", Icon: DatabaseOutlined },
  api: { label: "接口", Icon: ApiOutlined },
  design: { label: "设计", Icon: SkinOutlined },
  image: { label: "图片", Icon: PictureOutlined },
  video: { label: "视频", Icon: PlayCircleOutlined },
  music: { label: "音乐", Icon: SoundOutlined },
  ai: { label: "人工智能", Icon: RobotOutlined },
  chart: { label: "数据分析", Icon: BarChartOutlined },
  education: { label: "教育", Icon: ReadOutlined },
  news: { label: "资讯", Icon: NotificationOutlined },
  community: { label: "社区", Icon: MessageOutlined },
  shopping: { label: "购物", Icon: ShoppingOutlined },
  game: { label: "游戏", Icon: TrophyOutlined },
  security: { label: "安全", Icon: SafetyOutlined },
};

export function CategoryIcon({ value }: { value: NavCategoryRead["icon_key"] }) {
  const { Icon, label } = value == null ? { Icon: FolderOutlined, label: "默认分类" } : categoryIcons[value];
  return <Tooltip title={label}><Icon aria-label={`${label}图标`} style={{ fontSize: 18, width: 20, height: 20 }} /></Tooltip>;
}

const options = Object.entries(categoryIcons).map(([value, { Icon, label }]) => ({
  value,
  search: `${label} ${value}`,
  label: <Space><Icon aria-hidden="true" />{label}</Space>,
}));

export function CategoryIconSelect({ id, value, onChange, disabled }: {
  id?: string;
  value?: IconKey | null;
  onChange?: (value: IconKey | null) => void;
  disabled?: boolean;
}) {
  return <Select<IconKey>
    id={id}
    value={value ?? undefined}
    onChange={(next) => onChange?.(next ?? null)}
    disabled={disabled}
    allowClear={{ clearIcon: <CloseCircleOutlined aria-label="清除图标" /> }}
    showSearch
    optionFilterProp="search"
    placeholder={<Space><FolderOutlined aria-hidden="true" />默认分类</Space>}
    options={options}
    notFoundContent="无匹配图标"
    style={{ width: "100%" }}
  />;
}
