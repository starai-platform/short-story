import { SystemSettingsForm } from "@/components/system-settings-form";
import { getSiteSettings } from "@/lib/site-settings";

export default async function SettingsPage() {
  const settings = await getSiteSettings();
  return <><div className="mb-6"><p className="eyebrow">Brand & metadata</p><h2 className="mt-2 font-serif text-3xl font-semibold">系统设置</h2><p className="mt-2 text-sm text-black/45">统一配置站点品牌、浏览器信息与页面底部版权。</p></div><SystemSettingsForm initialSettings={settings} /></>;
}
