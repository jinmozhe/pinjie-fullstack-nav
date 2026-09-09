import type { NavCategoryRead, NavTaxonomyRead, SiteProfileRead } from "@pinjie/api-client";
import { LayoutGrid, Pin, X } from "lucide-react";
import { useEffect } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { SiteBrand } from "@/features/site";
import { HOME_LOCATION, TOP_LOCATION, isNavigationHome, type NavigationLocation } from "@/lib/navigation-location";
import { CategoryIcon } from "./CategoryIcon";
import { NavigationLink } from "./NavigationLink";
import { useModal } from "./useModal";

type Props = {
  profile: SiteProfileRead;
  categories: NavCategoryRead[];
  tags: NavTaxonomyRead[];
  location: NavigationLocation;
  onNavigate: (location: NavigationLocation) => void;
  showTop?: boolean;
};

export function SidebarContent({ profile, categories, tags, location, onNavigate, showTop = true }: Props) {
  return <>
    <div className="nav-sidebar-scroll">
      <nav className="nav-categories" aria-label="站点分类">
        <NavigationLink location={HOME_LOCATION} onNavigate={onNavigate} aria-current={isNavigationHome(location) ? "page" : undefined}><LayoutGrid size={18} aria-hidden="true" /><span>全部站点</span></NavigationLink>
        {showTop && <NavigationLink location={TOP_LOCATION} onNavigate={onNavigate} aria-current={location.top ? "page" : undefined}><Pin size={18} aria-hidden="true" /><span>置顶站点</span></NavigationLink>}
        {categories.map(category => <NavigationLink key={category.id} location={{ ...HOME_LOCATION, category: category.id }} onNavigate={onNavigate} aria-current={location.category === category.id ? "page" : undefined}><CategoryIcon value={category.icon_key} /><span>{category.name}</span></NavigationLink>)}
      </nav>
      {!!tags.length && <div className="nav-sidebar-tags"><h2>标签</h2><nav aria-label="站点标签">{tags.map(tag => <NavigationLink key={tag.id} location={{ ...HOME_LOCATION, tag: tag.id }} onNavigate={onNavigate} aria-current={location.tag === tag.id ? "page" : undefined}><span>{tag.name}</span></NavigationLink>)}</nav></div>}
    </div>
    <footer className="nav-copyright">© {new Date().getFullYear()} {profile.name}</footer>
  </>;
}

export function NavigationDrawer({ onClose, ...props }: Props & { onClose: () => void }) {
  const dialog = useModal();
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1100px)");
    const close = () => { if (media.matches) onClose(); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, [onClose]);
  return <dialog ref={dialog} className="nav-drawer" aria-label="分类与标签" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="nav-drawer-panel"><header><SiteBrand profile={props.profile} /><IconButton title="关闭菜单" onClick={onClose}><X size={20} /></IconButton></header><SidebarContent {...props} /></div>
  </dialog>;
}
