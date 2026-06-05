# Windows Power Shell ‚Å rakumoAPI‚ð’@‚­
. .\rakumoAPI.ps1
$directoryPath = Split-Path -Parent ($MyInvocation.MyCommand.Path)
$inputFile = "C:\rakumoSync\ad_users.csv"
$outputFile = "C:\rakumoSync\src\rakumo_users.csv"

function Get-DiffContactProfile {
    param(
      [String] $InputPath,
      [String] $OutputPath
    )
    $new = Get-Content $OutputPath| ? {$_.trim() -ne "" }
    $old = Get-Content $InputPath| ? {$_.trim() -ne "" }
    Write-Output (Compare-Object $new $old)
}

function Send-ErrorEmail {
  Param($upload,$download)

    $upload_date = (Get-ItemProperty $upload).LastWriteTime.ToString("yyyy/MM/dd")
   .\sendMail.ps1 3 $upload_date
   Write-Host "notification is sended!"
}

Get-ContactProfile | Out-File $outputFile -Encoding utf8
if (.\csvcheck.ps1 $inputFile $outputFile) {
  $output = Get-DiffContactProfile $inputFile $outputFile
  if ($output -eq $null) {
    Write-Host "There is no update"
  } else {
    Write-Host "There is an update!"
    ./sendMail.ps1 2
    Write-Host "notification is sended!"
  }
} else {
  Send-ErrorEmail $inputFile $outputFile
}