import { PageContainer } from "@ant-design/pro-components";
import { TaxonomyManager } from "./TaxonomyManager";

export default function CategoriesPage() {
  return (
    <PageContainer title="分类管理">
      <TaxonomyManager kind="categories" />
    </PageContainer>
  );
}
