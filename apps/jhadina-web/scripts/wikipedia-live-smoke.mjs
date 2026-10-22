// JHADINA-KNOWLEDGE.WIKIPEDIA.07 — network smoke on an ephemeral GitHub runner.
// Read-only; deliberately no secrets, auth credentials, article content logs or writes.
import assert from "node:assert/strict"

const host = "https://en.wikipedia.org"
const ua = "JhadinaWikipediaSmoke/0.2 (https://github.com/bookieandco/crispy-waddle)"
const results = []
async function probe(label, params) {
  const url = new URL("/w/api.php", host)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  url.searchParams.set("format", "json")
  url.searchParams.set("formatversion", "2")
  url.searchParams.set("maxlag", "5")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": ua, "Api-User-Agent": ua, "Accept": "application/json" },
      signal: controller.signal,
      redirect: "error",
    })
    if (!response.ok) throw new Error(label + " HTTP " + response.status)
    const data = await response.json()
    assert(!data.error, label + " MediaWiki error: " + (data.error?.code ?? "unknown"))
    results.push({ label, http: response.status, ok: true })
    return data
  } finally {
    clearTimeout(timer)
  }
}

const search = await probe("search_with_revisions", {
  action: "query", generator: "search", gsrsearch: "Ada Lovelace", gsrlimit: "2",
  gsrnamespace: "0", prop: "extracts|info|revisions",
  exintro: "1", explaintext: "1", exsentences: "4",
  inprop: "url", rvprop: "ids|timestamp", rvlimit: "1",
  redirects: "1",
})
const pages = search.query?.pages ?? []
const article = pages.find(page => page.title === "Ada Lovelace") ?? pages[0]
assert(article && Number.isSafeInteger(article.pageid) && article.pageid > 0, "No Wikipedia page ID")
assert(typeof article.extract === "string" && article.extract.length > 0, "No plain-text extract")
assert(typeof article.fullurl === "string" && article.fullurl.startsWith(host + "/wiki/"), "Missing article URL")
assert(Number.isSafeInteger(article.revisions?.[0]?.revid), "No revision provenance")
assert(!Number.isNaN(Date.parse(article.revisions?.[0]?.timestamp)), "No revision timestamp")

const parsed = await probe("article_citation_candidates", {
  action: "parse", pageid: String(article.pageid), prop: "wikitext|externallinks",
})
assert(parsed.parse && typeof parsed.parse.title === "string", "No parsed article")
assert(typeof parsed.parse.wikitext === "string" || typeof parsed.parse.wikitext?.["*"] === "string", "No wikitext")
assert(Array.isArray(parsed.parse.externallinks), "No external link list")

console.log(JSON.stringify({ status: "pass", verified: "upstream API contract only", checks: results, pageId: article.pageid, revisionId: article.revisions[0].revid, fullArticleLogged: false }))
