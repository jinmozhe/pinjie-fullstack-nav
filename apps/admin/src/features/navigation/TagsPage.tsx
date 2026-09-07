import { PageContainer } from "@ant-design/pro-components";
import { TaxonomyManager } from "./TaxonomyManager";

export default function TagsPage() {
  return (
    <PageContainer title="标签管理">
      <TaxonomyManager kind="tags" />
    </PageContainer>
  );
}
