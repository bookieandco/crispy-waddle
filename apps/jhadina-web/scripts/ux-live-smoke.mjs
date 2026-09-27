const base=process.env.JHADINA_BASE_URL??"http://127.0.0.1:3100"
const routes=[
 ["/","Ask Jhadina"],
 ["/ask-jhadina","What are we doing?"],
 ["/work","Continue what matters."],
 ["/activity","What happened, in order."],
 ["/worlds","One OS. Every subsystem."],
 ["/worlds/sports","Sports Intelligence"],
 ["/music",null],
 ["/jhadinatv",null],
 ["/workstation",null],
 ["/opportunity",null],
 ["/social",null],
 ["/settings/privacy","Privacy"],
]
async function get(path){
 let last
 for(let i=0;i<40;i++){
  try{
   const response=await fetch(base+path,{redirect:"manual"})
   if(response.status>=200&&response.status<400)return response
   last=new Error(path+" returned "+response.status)
  }catch(error){last=error}
  await new Promise(resolve=>setTimeout(resolve,500))
 }
 throw last
}
for(const [path,needle] of routes){
 const response=await get(path)
 if(response.status>=300)throw new Error(path+" redirected during authenticated UX smoke to "+response.headers.get("location"))
 const html=await response.text()
 if(needle&&!html.includes(needle))throw new Error(path+" did not render expected text: "+needle)
 console.log("PASS",path,response.status,needle??"rendered")
}
console.log("UX-LIVE-E2E PASS",routes.length+" surfaces")
