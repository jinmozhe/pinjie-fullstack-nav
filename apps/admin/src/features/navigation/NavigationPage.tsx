import { Tabs } from "antd";
import { PageFrame } from "@/components/PageFrame";
import { SitesManager } from "./SitesManager";

export default function NavigationPage() {
  return <PageFrame title="站点管理"><Tabs destroyOnHidden items={[
    { key: "sites", label: "站点", children: <SitesManager deleted={false} /> },
    { key: "recycle", label: "回收站", children: <SitesManager deleted /> },
  ]} /></PageFrame>;
}
