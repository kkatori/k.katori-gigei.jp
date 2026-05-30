#引数1：エラーコード
#引数2：ファイルの更新日付
Param(
    [String]$errcode,
    [String]$update_date
)

#設定ファイルインポート
$directoryPath = Split-Path -Parent ($MyInvocation.MyCommand.Path)
$configFile = $directoryPath + "\config.toml"
$file = Get-Content $configFile
$list = @{}
$index = 0
foreach ($line in $file) {
    if ($line -match "=") {
        $param = $line.split("=",2)
        $list[$index] = $param[1].Trim()
        $index++
    }
}

#メール送信情報セット
$mailFrom = $list[0]
$mailTo = $list[1]
$passMailFrom = $list[2]
$server = $list[3]
$port = $list[4]

#メール内容セット
$mailSubject = $list[5]
$MailText = $list[6] -replace '\[newline\]', "`r`n"
$MailText = $MailText -replace '\[errcode\]',$errcode
$MailText = $MailText -replace '\[update_date\]',$update_date

if ($passMailFrom -eq "") {
    Send-MailMessage -from $mailFrom -to $mailTo -subject $mailSubject -body $MailText -Encoding ([System.Text.Encoding]::UTF8) -SmtpServer $server -Port $port -UseSsl
} else {
$secpasswd = ConvertTo-SecureString $passMailFrom -AsPlainText -Force
$mailCred = New-Object System.Management.Automation.PSCredential($mailFrom, $secpasswd)
Send-MailMessage -from $mailFrom -to $mailTo -subject $mailSubject -body $MailText -Encoding ([System.Text.Encoding]::UTF8) -SmtpServer $server -Port $port -Credential $mailCred -UseSsl
}
