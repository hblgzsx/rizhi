// Runs before CSS so a saved dark preference does not flash a white page.
(() => {
  const key='rizhi.appearance.v1',system=matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try{preference=localStorage.getItem(key);}catch{}
  if(!['light','dark'].includes(preference))preference=null;
  function apply(theme){
    const dark=theme==='dark';document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#161d19':'#f8f9f5');
    document.querySelectorAll('[data-action="theme-toggle"]').forEach(button=>{
      button.setAttribute('aria-label',dark?'切换为浅色模式':'切换为深色模式');
      button.title=dark?'切换为浅色模式':'切换为深色模式';button.setAttribute('aria-pressed',String(dark));
    });
  }
  function refresh(){apply(preference|| (system.matches?'dark':'light'));}
  window.RizhiTheme={
    sync:refresh,
    toggle(){preference=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem(key,preference);}catch{}apply(preference);}
  };
  system.addEventListener('change',()=>{if(!preference)refresh();});
  addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=['light','dark'].includes(event.newValue)?event.newValue:null;refresh();}});
  refresh();
  addEventListener('DOMContentLoaded',refresh,{once:true});
})();
