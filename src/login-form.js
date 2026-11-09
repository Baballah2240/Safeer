/** Ephemeral form state only: credentials never enter browser storage or markup. */
export function loginFormState() {
  let draft={login:'',password:''},pending=true;
  const capture=form=>{
    if(form)draft={login:form.elements.namedItem('login').value,password:form.elements.namedItem('password').value};
  };
  const restore=form=>{
    if(!form)return;
    form.elements.namedItem('login').value=draft.login;
    form.elements.namedItem('password').value=draft.password;
    form.setAttribute('aria-busy',String(pending));
    form.querySelector('button').disabled=pending;
  };
  return {
    capture,restore,
    begin(form){
      if(pending)return null;
      capture(form);pending=true;restore(form);
      return {...draft};
    },
    finish(form,failed=false){
      pending=false;
      capture(form);
      if(failed)draft.password='';
      restore(form);
    },
    clear(){draft={login:'',password:''};},
  };
}
