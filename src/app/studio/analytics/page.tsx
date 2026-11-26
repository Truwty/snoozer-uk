import Link from "next/link";
import { z } from "zod";
import { AnalyticsChart } from "@/components/analytics-chart";
import { CountryAnalyticsMap } from "@/components/country-analytics-map";
import { socialProviderForUrl } from "@/lib/social-providers";
import { browserAnalytics, browserCtr, dailyAnalytics, linkAnalytics, trafficAnalytics, parseAnalyticsRange, analyticsRangeStart } from "@/lib/analytics";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { TableScroll } from "@/components/ui";
import { sessionClient } from "@/lib/supabase";

export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

type Range = "3d" | "7d" | "30d" | "all";
type Query = StudioProfileQuery & { range?: string | string[] };

function compact(value:number){
  return value.toLocaleString("en-GB");
}
function sourceLabel(value:string){
  const labels:Record<string,string>={direct:"Direct",search:"Search engines",social:"Social media",video:"Video platforms",developer:"Developer sites",email:"Email",other:"Other websites"};
  return labels[value]??value;
}
function Empty({title,description}:{title:string;description:string}){
  return <div className="analytics-empty"><strong>{title}</strong><span>{description}</span></div>;
}
function donutGradient(rows:Array<{label:string;count:number;color:string}>,total:number){
  if(!total)return "conic-gradient(#343a35 0deg 360deg)";
  let cursor=0;
  return "conic-gradient("+rows.filter(row=>row.count>0).map(row=>{
    const start=cursor;cursor+=row.count/total*360;
    return row.color+" "+start.toFixed(2)+"deg "+cursor.toFixed(2)+"deg";
  }).join(", ")+")";
}

export default async function Page({searchParams}:{searchParams:Promise<Query>}){
  const params=await searchParams;
  const range=parseAnalyticsRange(params.range);
  const draft=await readStudioDraft(params.profile);
  const client=await sessionClient();
  const [viewsResponse,linksResponse,trafficResponse,countryResponse,browserResponse]=draft?await Promise.all([
    client.rpc("get_my_profile_view_days",{p_profile:draft.profile_id}),
    client.rpc("get_my_profile_link_totals",{p_profile:draft.profile_id}),
    client.rpc("get_my_profile_traffic_totals",{p_profile:draft.profile_id}),
    client.rpc("get_my_profile_country_totals",{p_profile:draft.profile_id,p_since:range==="all"?null:analyticsRangeStart(range)}),
    client.rpc("get_my_profile_browser_days",{p_profile:draft.profile_id})
  ]):[];

  const parsedDays=dailyAnalytics.safeParse(viewsResponse?.data);
  const parsedLinks=linkAnalytics.safeParse(linksResponse?.data);
  const parsedTraffic=trafficAnalytics.safeParse(trafficResponse?.data);
  const parsedBrowsers=browserAnalytics.safeParse(browserResponse?.data);
  const parsedCountries=z.array(z.object({
    country_code:z.string().regex(/^[A-Z]{2}$/),
    views:z.number().int().nonnegative().safe(),
    clicks:z.number().int().nonnegative().safe()
  })).max(300).safeParse(countryResponse?.data);

  const rows=parsedDays.success
    ? range==="all"?parsedDays.data:parsedDays.data.filter(row=>row.day>=analyticsRangeStart(range))
    : [];
  const links=parsedLinks.success?parsedLinks.data:[];
  const traffic=parsedTraffic.success?parsedTraffic.data:[];
  const browserRows=parsedBrowsers.success
    ? range==="all"?parsedBrowsers.data:parsedBrowsers.data.filter(row=>row.day>=analyticsRangeStart(range))
    : [];
  const browserTotal=browserRows.reduce((sum,row)=>sum+row.unique_browsers,0);
  const browserClicked=browserRows.reduce((sum,row)=>sum+row.clicked_browsers,0);
  const countries=parsedCountries.success?parsedCountries.data.map(row=>({
    ...row,name:new Intl.DisplayNames(["en-GB"],{type:"region"}).of(row.country_code)??row.country_code
  })):[];
  const views=rows.reduce((sum,row)=>sum+row.views,0);
  const clicks=rows.reduce((sum,row)=>sum+row.clicks,0);
  const dayCount=range==="3d"?3:range==="7d"?7:range==="30d"?30:Math.max(rows.length,1);
  const average=views/dayCount;
  const clickRate=views>0?(clicks/views*100).toFixed(2)+"%":"0.00%";
  const rangeLabel=range==="3d"?"Last 3 days":range==="7d"?"Last 7 days":range==="30d"?"Last 30 days":"All available time";

  const socialLinks=links.filter(row=>socialProviderForUrl(row.url)!==null&&row.clicks>0)
    .sort((a,b)=>b.clicks-a.clicks).slice(0,6);
  const buttonLinks=links.filter(row=>socialProviderForUrl(row.url)===null&&row.clicks>0)
    .sort((a,b)=>b.clicks-a.clicks).slice(0,6);

  const devices=traffic.reduce<Record<string,number>>((result,row)=>{
    result[row.device]=(result[row.device]??0)+row.views;
    return result;
  },{});
  const deviceColours:Record<string,string>={desktop:"#d8fb86",mobile:"#8cbd9b",tablet:"#6e8a78",unknown:"#59645b"};
  const deviceRows=["desktop","mobile","tablet","unknown"].filter(key=>(devices[key]??0)>0)
    .map(key=>({label:key[0].toUpperCase()+key.slice(1),count:devices[key]??0,color:deviceColours[key]}));
  const deviceTotal=deviceRows.reduce((sum,row)=>sum+row.count,0);
  const sources=traffic.reduce<Record<string,number>>((result,row)=>{
    result[row.source]=(result[row.source]??0)+row.views;
    return result;
  },{});
  const topReferrers=Object.entries(sources).filter(([,count])=>count>0)
    .sort((a,b)=>b[1]-a[1]).slice(0,6);
  const periodHint=range==="all"?"Within your plan’s analytics retention window":"In the "+rangeLabel.toLowerCase();

  return <main className="shell studio-shell analytics-page analytics-reference-page">
    <header className="studio-page-heading">
      <div><p className="eyebrow">ACCOUNT / ANALYTICS</p><h1>Account Analytics</h1>
        <p className="muted">Track your profile performance and see how many people are visiting your page.</p></div>
      {draft&&<Link className="button small" href={"/"+draft.username} target="_blank" rel="noreferrer">View My Page ↗</Link>}
    </header>

    {!draft?<section className="studio-dashboard-panel stack">
      <h2>Your profile is not ready yet</h2><p className="muted">Claim a Snoozer profile to start seeing consent-based activity reports.</p>
      <Link className="button primary" href="/studio">Claim a profile</Link>
    </section>:<>
      <section className="analytics-range-bar" aria-label="Analytics time range">
        <form action="/studio/analytics" method="get">
          <input type="hidden" name="profile" value={draft.profile_id}/>
          <label>Time Range<select name="range" defaultValue={range} aria-label="Analytics time range">
            <option value="3d">Last 3 days</option><option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option><option value="all">All available time</option>
          </select></label>
          <button className="button small" type="submit">Apply</button>
        </form>
        <span>Updated when this page loads</span>
      </section>

      {viewsResponse?.error&&<p className="message error" role="alert">Profile analytics could not be loaded right now. Reload to try again.</p>}
      <section className="analytics-metrics" aria-label="Analytics summary">
        <article className="analytics-metric"><span>Total Link Clicks</span><strong>{compact(clicks)}</strong><small>{periodHint}</small></article>
        <article className="analytics-metric"><span>Click Rate</span><strong>{clickRate}</strong><small>{periodHint}</small></article>
        <article className="analytics-metric"><span>Profile Views</span><strong>{compact(views)}</strong><small>{periodHint}</small></article>
        <article className="analytics-metric"><span>Average Daily Views</span><strong>{average.toLocaleString("en-GB",{maximumFractionDigits:1})}</strong><small>Average across selected days</small></article>
      </section>

      <section className="analytics-reference-main">
        <article className="analytics-card analytics-reference-chart">
          <div className="analytics-card-heading"><div><h2>Profile Views</h2><p>{rangeLabel} · UTC dates</p></div></div>
          {rows.length?<AnalyticsChart rows={rows}/>:<Empty title="No profile views yet" description="Views appear here when visitors allow analytics on your published Snoozer page."/>}
        </article>
        <article className="analytics-card analytics-reference-devices">
          <div className="analytics-card-heading"><div><h2>Visitor Devices</h2><p>{rangeLabel}</p></div></div>
          {deviceTotal>0?<>
            <div className="analytics-reference-donut" role="img"
              aria-label={deviceRows.map(row=>row.label+" "+row.count).join(", ")}
              style={{background:donutGradient(deviceRows,deviceTotal)}}>
              <div><strong>{compact(deviceTotal)}</strong><span>Recorded views</span></div>
            </div>
            <ul className="analytics-reference-device-legend">
              {deviceRows.map(row=><li key={row.label}><span><i style={{background:row.color}}/>{row.label}</span><strong>{compact(row.count)}</strong></li>)}
            </ul>
          </>:<Empty title="No device data yet" description="Share your profile to build an aggregated device breakdown."/>}
          <p className="muted">Device categories are approximate and do not identify individual visitors.</p>
        </article>
      </section>

      <section className="analytics-reference-breakdowns">
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Most Clicked Socials</h2><p>Popular social profile links</p></div></div>
          {socialLinks.length?<ol className="analytics-reference-ranking">
            {socialLinks.map(row=><li key={row.url+row.label}><span>{row.label}</span><strong>{compact(row.clicks)}</strong></li>)}
          </ol>:<Empty title="No social clicks yet" description="Clicks on recognised social links will appear here."/>}
        </article>
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Most Clicked Buttons</h2><p>Custom destinations on your profile</p></div></div>
          {buttonLinks.length?<ol className="analytics-reference-ranking">
            {buttonLinks.map(row=><li key={row.url+row.label}><span>{row.label}</span><strong>{compact(row.clicks)}</strong></li>)}
          </ol>:<Empty title="No button clicks yet" description="Clicks on custom profile buttons will appear here."/>}
        </article>
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Top Referrers</h2><p>Broad incoming traffic channels</p></div></div>
          {topReferrers.length?<ol className="analytics-reference-ranking">
            {topReferrers.map(([source,count])=><li key={source}><span>{sourceLabel(source)}</span><strong>{compact(count)}</strong></li>)}
          </ol>:<Empty title="No referrers yet" description="Approximate traffic channels appear here when visitors allow analytics."/>}
          <p className="muted">Only broad source categories are kept. Full referrer URLs are not stored.</p>
        </article>
      </section>

      <section className="analytics-card analytics-reference-countries">
        <div className="analytics-card-heading"><div><h2>Top Countries by Views</h2><p>Approximate visitor location · separate opt-in</p></div>
          <span className="muted">Minimum 3 views per country</span></div>
        {countryResponse?.error?<Empty title="Country analytics unavailable" description="Other analytics continue to work. Country reporting requires the hosting edge to provide a country code."/>
          :countries.length?<>
            <CountryAnalyticsMap countries={countries}/>
            <details className="analytics-country-details"><summary>View country totals</summary>
              <table className="analytics-data-table">
                <thead><tr><th scope="col">Country</th><th scope="col">Views</th><th scope="col">Clicks</th></tr></thead>
                <tbody>{countries.map(row=><tr key={row.country_code}><th scope="row">{row.name}</th><td>{compact(row.views)}</td><td>{compact(row.clicks)}</td></tr>)}</tbody>
              </table>
            </details>
          </>:<Empty title="No country data yet" description="Visitors must separately allow approximate country reporting. Snoozer shows country totals only after at least three consented views."/>}
        <p className="muted">Country estimates can be wrong for VPNs, relays or mobile networks. Snoozer stores daily country totals only, not raw IP addresses or precise location.</p>
      </section>

      <section className="analytics-card stack">
        <div className="analytics-card-heading">
          <div><h2>Daily Activity</h2><p>Recorded views and link clicks by UTC date</p></div>
          <a className="button small" download="snoozer-analytics.csv" href={studioHref("/api/v1/analytics/export",draft.profile_id)}>Download CSV</a>
        </div>
        {rows.length?<details className="analytics-daily-details">
          <summary>Daily activity table</summary>
          <TableScroll label="Daily activity report">
            <table className="analytics-data-table">
              <caption>Recorded activity by UTC day within your plan’s retention window</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Views</th><th scope="col">Clicks</th></tr></thead>
              <tbody>{rows.map(row=><tr key={row.day}><th scope="row"><time dateTime={row.day}>{row.day}</time></th><td>{compact(row.views)}</td><td>{compact(row.clicks)}</td></tr>)}</tbody>
            </table>
          </TableScroll>
        </details>:<Empty title="No daily activity" description="There are no recorded events in this time range."/>}
      </section>

      {browserRows.length>0&&<section className="analytics-card stack">
        <div className="analytics-card-heading">
          <div><h2>Daily Browsers & Click Rate</h2><p>Browser-day observations, not unique people</p></div>
          <a className="button small" download="snoozer-browser-analytics.csv" href={studioHref("/api/v1/analytics/export?breakdown=browsers",draft.profile_id)}>Download browser CSV</a>
        </div>
        <p className="muted">{compact(browserTotal)} browser-day observations · {compact(browserClicked)} with a recorded click · {browserCtr(browserTotal,browserClicked)}</p>
        <TableScroll label="Daily browser report">
          <table className="analytics-data-table">
            <caption>Daily browser observations within your plan’s retention window</caption>
            <thead><tr><th scope="col">UTC date</th><th scope="col">Daily browsers</th><th scope="col">Clicked browsers</th><th scope="col">Browser CTR</th></tr></thead>
            <tbody>{browserRows.map(row=><tr key={row.day}><th scope="row">{row.day}</th><td>{compact(row.unique_browsers)}</td><td>{compact(row.clicked_browsers)}</td><td>{browserCtr(row.unique_browsers,row.clicked_browsers)}</td></tr>)}</tbody>
          </table>
        </TableScroll>
        {browserResponse?.error&&<p role="alert" className="message error">Browser reports are temporarily unavailable.</p>}
      </section>}

      {links.length>0&&<section className="analytics-card stack">
        <div className="analytics-card-heading">
          <div><h2>Published Link Activity</h2><p>Clicks attributed to published destinations within your plan’s retention window</p></div>
          <a className="button small" download="snoozer-link-analytics.csv" href={studioHref("/api/v1/analytics/export?breakdown=links",draft.profile_id)}>Download link CSV</a>
        </div>
        <TableScroll label="Per-link report">
          <table className="analytics-data-table">
            <caption>Clicks attributed to published destinations</caption>
            <thead><tr><th scope="col">Link</th><th scope="col">Clicks</th></tr></thead>
            <tbody>{links.map(({label,url,clicks:linkClicks})=><tr key={JSON.stringify([label,url])}>
              <th scope="row"><a href={url} rel="nofollow noreferrer">{label}</a><small>{url}</small></th><td>{compact(linkClicks)}</td>
            </tr>)}</tbody>
          </table>
        </TableScroll>
      </section>}

      <p className="muted">Analytics are optional. Counts are events, not guaranteed unique people. Daily views use the selected range; device and referring-channel breakdowns use the analytics retention window of your plan.</p>
    </>}
  </main>;
}
