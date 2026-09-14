import StaffLogin from '../StaffLogin';
export default async function Login({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <StaffLogin slug={slug}/>;}
