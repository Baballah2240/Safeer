param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
$taskAcl=Get-Acl -LiteralPath $Path
$taskSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$taskSystem=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
function Test-PrivateRuntimeAcl($acl) {
  $rules=@($acl.Access)
  if (!$acl.AreAccessRulesProtected -or $rules.Count -ne 2) { return $false }
  foreach($sid in @($taskSid.Value,$taskSystem.Value)) {
    $matching=@($rules | Where-Object {
      $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq $sid -and
      $_.AccessControlType -eq 'Allow' -and !$_.IsInherited -and
      ($_.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -eq [System.Security.AccessControl.FileSystemRights]::FullControl -and
      ($_.InheritanceFlags -band [System.Security.AccessControl.InheritanceFlags]::ContainerInherit) -and
      ($_.InheritanceFlags -band [System.Security.AccessControl.InheritanceFlags]::ObjectInherit)
    })
    if($matching.Count -ne 1) { return $false }
  }
  return $true
}
# Reuse an already private ACL rather than rewriting it on every restart.
if(Test-PrivateRuntimeAcl $taskAcl) { exit 0 }
$taskAcl.SetAccessRuleProtection($true,$false)
foreach($taskRule in @($taskAcl.Access)) { $taskAcl.RemoveAccessRuleSpecific($taskRule) }
foreach($sid in @($taskSid,$taskSystem)) {
  $taskAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
}
Set-Acl -LiteralPath $Path -AclObject $taskAcl
if(!(Test-PrivateRuntimeAcl (Get-Acl -LiteralPath $Path))) { throw 'Runtime permissions could not be verified.' }
