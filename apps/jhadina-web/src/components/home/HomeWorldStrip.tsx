import Link from "next/link"

const worlds=[
 {label:"TV",glyph:"▣",href:"/jhadinatv"},
 {label:"Music",glyph:"♫",href:"/music"},
 {label:"Social",glyph:"◎",href:"/social"},
 {label:"YouTube",glyph:"▶",href:"/social"},
 {label:"Director",glyph:"◆",href:"/workstation"},
 {label:"Money",glyph:"$",href:"/money/command-center"},
 {label:"Shark",glyph:"◈",href:"/wallet"},
 {label:"Sports",glyph:"🏆",href:"/worlds/sports"},
 {label:"Opportunities",glyph:"★",href:"/opportunity"},
 {label:"SAM",glyph:"⌂",href:"/opportunity/sam"},
 {label:"Spatial",glyph:"⌖",href:"/spatial"},
 {label:"PupsonStuff",glyph:"●",href:"/worlds/pupsonstuff"},
 {label:"Overage",glyph:"◇",href:"/worlds/overage"},
] as const

export function HomeWorldStrip(){
 return <nav className="jh-world-strip" aria-label="Open a Jhadina subsystem">
  {worlds.map(world=><Link className="jh-world-chip" href={world.href} key={world.label}>
   <span className="jh-world-icon" aria-hidden="true">{world.glyph}</span>
   <span>{world.label}</span>
  </Link>)}
 </nav>
}
