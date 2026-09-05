import { PageContainer } from "@ant-design/pro-components";
import { Tabs } from "antd";
import { SitesManager } from "./SitesManager";
import { TaxonomyManager } from "./TaxonomyManager";

export default function NavigationPage() {
  return <PageContainer title="导航管理"><Tabs destroyOnHidden items={[
    { key: "sites", label: "站点", children: <SitesManager deleted={false} /> },
    { key: "categories", label: "分类", children: <TaxonomyManager kind="categories" /> },
    { key: "tags", label: "标签", children: <TaxonomyManager kind="tags" /> },
    { key: "recycle", label: "回收站", children: <SitesManager deleted /> },
  ]} /></PageContainer>;
}
