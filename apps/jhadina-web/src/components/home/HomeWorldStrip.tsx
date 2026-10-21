import Link from "next/link"

const worlds=[
 {label:"TV",glyph:"▣",href:"/jhadinatv"},
 {label:"Music",glyph:"♫",href:"/music"},
 {label:"YouTube",glyph:"▶",href:"/#jhadina-feed"},
 {label:"Social",glyph:"◎",href:"/social"},
 {label:"Money",glyph:"$",href:"/money/command-center"},
 {label:"Sports",glyph:"🏆",href:"/worlds/sports"},
 {label:"Director",glyph:"◆",href:"/workstation"},
 {label:"Opportunities",glyph:"★",href:"/opportunity"},
 {label:"PupsonStuff",glyph:"●",href:"/worlds/pupsonstuff"},
] as const

export function HomeWorldStrip(){
 return <nav className="jh-world-strip" aria-label="Open a Jhadina subsystem">
  {worlds.map(world=><Link className="jh-world-chip" href={world.href} key={world.label}>
   <span className="jh-world-icon" aria-hidden="true">{world.glyph}</span>
   <span>{world.label}</span>
  </Link>)}
 </nav>
}
