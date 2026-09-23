const API_URL="https://coavjcqfvd.execute-api.us-west-2.amazonaws.com/Stage-1";
let questions=[],index=0,selected=new Set(),shown=false;
const $=id=>document.getElementById(id);
function status(t="",err=false){$("status").textContent=t;$("status").classList.toggle("error",err)}
async function load(){
  try{
    status("Loading question bank…");
    const r=await fetch(API_URL); if(!r.ok) throw new Error(`API returned HTTP ${r.status}`);
    const api=await r.json(); let payload=api.body;
    if(typeof payload==="string") payload=JSON.parse(payload);
    questions=payload.objects.flatMap(o=>Array.isArray(o.content)?o.content:[]);
    if(!questions.length) throw new Error("No questions were found.");
    render(); status(`${questions.length.toLocaleString()} questions loaded`);
  }catch(e){console.error(e);$("question").textContent="Unable to load the quiz";$("options").innerHTML="";status(`${e.message}. If this is a browser CORS error, enable CORS on API Gateway.`,true)}
}
function render(){
  const q=questions[index]; selected=new Set(); shown=false;
  const multiple=Array.isArray(q.Anwer)&&q.Anwer.length>1;
  $("num").textContent=index+1; $("counter").textContent=`Question ${index+1} of ${questions.length}`;
  $("question").textContent=q.Question||"Untitled question";
  $("selectionHint").textContent=multiple?"Select all that apply":"Select one answer";
  $("answerPanel").classList.add("hidden"); $("show").textContent="Show Answer"; $("options").innerHTML="";
  (q.Options||[]).forEach((text,i)=>{
    const letter=String.fromCharCode(65+i),b=document.createElement("button"); b.className="option"; b.type="button";
    b.innerHTML=`<span class="badge">${letter}</span><span class="optionText"></span>`; b.querySelector(".optionText").textContent=text;
    b.onclick=()=>{if(shown)return;if(multiple){if(selected.has(letter)){selected.delete(letter);b.classList.remove("selected")}else{selected.add(letter);b.classList.add("selected")}}else{selected.clear();selected.add(letter);document.querySelectorAll(".option").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")}};
    $("options").appendChild(b);
  });
  $("prev").disabled=index===0; $("next").textContent=index===questions.length-1?"Finish →":"Next →"; $("progress").style.width=`${((index+1)/questions.length)*100}%`;
}
function showAnswer(){
  const q=questions[index],answers=Array.isArray(q.Anwer)?q.Anwer:[]; shown=true;
  document.querySelectorAll(".option").forEach((b,i)=>{const letter=String.fromCharCode(65+i);if(answers.includes(letter))b.classList.add("correct");else if(selected.has(letter))b.classList.add("wrong")});
  $("correct").textContent=answers.map(a=>q.Options?.[a.charCodeAt(0)-65]??a).join(", ")||"Answer not provided";
  $("explanation").textContent=q.Explanation||"No explanation was provided."; $("answerPanel").classList.remove("hidden"); $("show").textContent="Answer Shown";
}
$("show").onclick=()=>{if(!shown)showAnswer()}; $("prev").onclick=()=>{if(index>0){index--;render()}}; $("next").onclick=()=>{index=index<questions.length-1?index+1:0;render()}; load();
