import { PageFrame } from "@/components/PageFrame";
import { TaxonomyManager } from "./TaxonomyManager";

export default function CategoriesPage() {
  return (
    <PageFrame title="分类管理">
      <TaxonomyManager kind="categories" />
    </PageFrame>
  );
}
