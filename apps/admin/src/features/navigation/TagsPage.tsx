import { PageFrame } from "@/components/PageFrame";
import { TaxonomyManager } from "./TaxonomyManager";

export default function TagsPage() {
  return (
    <PageFrame title="标签管理">
      <TaxonomyManager kind="tags" />
    </PageFrame>
  );
}
