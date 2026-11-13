import type { Store } from './db.js';

/** Deliberately fictional people, contacts and histories. No real candidate data. */
export function seedDemo(store:Store) {
  if(store.jobs().length || store.candidates().length)return;
  const fde=store.createJob({title:'FDE 工程实习生',department:'AI 应用与交付',location:'北京 / 远程协作',employmentType:'实习',status:'open',
    description:'参与 AI 安全应用的需求梳理、TypeScript 开发、接口对接与部署验证。希望能把客户问题拆成可验收的任务，使用 Git 和自动化测试完成交付。招聘评价以项目证据为依据，面试核实本人承担的工作。',
    criteria:[
      {id:'typescript',label:'TypeScript 开发实践',weight:30,required:true,keywords:['TypeScript','React','Node.js']},
      {id:'delivery',label:'部署与验证经历',weight:25,required:true,keywords:['Docker','部署','测试','CI']},
      {id:'security',label:'安全项目实践',weight:20,required:false,keywords:['安全','漏洞','WAF','资产']},
      {id:'ai',label:'模型与接口实践',weight:15,required:false,keywords:['API','模型','RAG','Agent']},
      {id:'requirements',label:'需求理解与协作',weight:10,required:true,keywords:['需求','验收','文档','Git']},
    ]});
  const presales=store.createJob({title:'安全解决方案工程师',department:'行业解决方案',location:'北京',employmentType:'全职',status:'open',
    description:'面向行业客户完成安全需求分析、方案设计、PoC 及交付协同。需要能用客户可理解的语言解释技术价值，并提供相关方案、验证和沟通经历。',
    criteria:[
      {id:'solution',label:'需求与方案能力',weight:35,required:true,keywords:['方案','客户','需求']},
      {id:'security',label:'网络安全实践',weight:30,required:true,keywords:['WAF','漏洞','安全','SOC']},
      {id:'poc',label:'验证与交付能力',weight:25,required:true,keywords:['PoC','验证','交付','测试']},
      {id:'docs',label:'表达与文档',weight:10,required:false,keywords:['汇报','文档','培训','演示']},
    ]});
  const fixtures=[
    {name:'示例候选人 A',headline:'全栈开发 · 交付实践',tags:['演示数据','TypeScript','Docker'],resumeText:'【虚构样例，用于功能演示】\n项目经历\n在课程项目中使用 TypeScript、React 和 Node.js 开发资产查询工作台，负责查询接口与前端表格。\n使用 Docker 完成开发环境部署，编写接口测试并在 CI 中执行。\n接入模型 API 实现安全告警摘要，整理需求与验收文档，通过 Git 提交变更。\n安全实践\n在授权实验环境分析 Web 漏洞，编写复现步骤；尚无生产环境独立运维经历。\n希望面试时展示项目代码、部署记录和具体承担的工作。'},
    {name:'示例候选人 B',headline:'安全方案 · 客户沟通',tags:['演示数据','安全方案'],resumeText:'【虚构样例，用于功能演示】\n项目经历\n协助客户梳理网络安全需求，编写 WAF 与 SOC 联动方案。\n参与授权 PoC 测试，整理验证步骤、交付记录和问题清单。\n完成方案汇报、产品演示以及操作文档。\n使用 Git 管理文档版本；熟悉基础脚本，尚未使用 TypeScript 完成独立开发。\n希望从行业解决方案转向 AI 应用交付，模型接口经验需要进一步核实。'},
    {name:'示例候选人 C',headline:'前端开发 · 待补充交付证据',tags:['演示数据','React'],resumeText:'【虚构样例，用于功能演示】\n课程与作品\n使用 TypeScript 和 React 完成任务管理页面，包括列表、筛选和表单交互。\n通过 Git 管理代码，编写组件使用文档，参与同学之间的代码评审。\n项目主要运行在本地，简历未说明服务端开发、部署、自动化测试或安全项目经历。\n期待通过面试展示页面作品并补充具体实践材料。'},
  ];
  fixtures.forEach((item,index)=>{
    const candidate=store.createCandidate({...item,email:`demo-${index+1}@example.invalid`,phone:'',},{status:'ready',message:null});
    const a=store.createApplication(fde.id,candidate.id);store.createTask(a.id,'rules');
    if(index===1)store.createApplication(presales.id,candidate.id);
  });
}
