import { PageContainer } from "@ant-design/pro-components";
import { Tabs } from "antd";
import { SitesManager } from "./SitesManager";

export default function NavigationPage() {
  return <PageContainer title="站点管理"><Tabs destroyOnHidden items={[
    { key: "sites", label: "站点", children: <SitesManager deleted={false} /> },
    { key: "recycle", label: "回收站", children: <SitesManager deleted /> },
  ]} /></PageContainer>;
}
