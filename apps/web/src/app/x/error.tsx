"use client";

export default function XNavigationError() {
  return (
    <main className="nav-standalone">
      <section className="nav-standalone-container nav-empty" role="alert">
        <h1>站点列表加载失败</h1>
        <p>暂时无法读取站点列表，请稍后重新加载。</p>
        <button className="status-action" type="button" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </section>
    </main>
  );
}
