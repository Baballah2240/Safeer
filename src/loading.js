// Decorative placeholders never represent real trips, prices or tracking status.
export function shimmer(language='en',{compact=false}={}){
 const label=language==='ar'?'\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644\u2026':'Loading\u2026';
 const card=()=>'<div class="shimmer-card"><span class="shimmer-block shimmer-title"></span><span class="shimmer-block shimmer-line"></span><div class="shimmer-fields"><span class="shimmer-block"></span><span class="shimmer-block"></span></div><span class="shimmer-block shimmer-short"></span></div>';
 return '<div class="safeer-shimmer'+(compact?' safeer-shimmer-compact':'')+'" role="status" aria-live="polite"><span class="shimmer-status">'+label+'</span><div class="shimmer-shapes" aria-hidden="true">'+card()+(compact?'':card())+'</div></div>';
}
