$directoryPath = Split-Path -Parent ($MyInvocation.MyCommand.Path)
$userFile = $directoryPath + "\users.csv"
$groupFile = $directoryPath + "\groups.csv"
$newUserFile = $directoryPath + "\..\ad_users.csv"
$rakumo2adFile = $directoryPath + "\rakumo2ad.config"
$sortPropertyFile = $directoryPath + "\sort_properties.config"
$addstringFile = $directoryPath + "\..\config.tml"

#Job Title Code追加のためのAD属性記述ファイル
$JobTitleCodePropertyFile = $directoryPath + "\JTC_properties.config"
$JTCGroupMailPropertyFile = $directoryPath + "\JTC_groupmail.config"

function Check-Error {
  param(
    [Parameter(ValueFromPipeline = $true,Mandatory = $true)]
    [object[]]
    $Users
  )
  begin {
  } process {
    foreach ($u in $Users) {
      if (($u.mail -eq "") -or ($u.groupMail -eq "")) {
        #Send-ErrorEmail -Subject "Error!" -Body "Error occured!!"
        #throw "group mail and user mail are empty"
        .\sendMail.ps1 1
        Write-Host($u)
        break
      } else {
        Write-Output $u
      }
    }
  } end {}
}


# sort csv function
# sort based on properties from "sort_properties.config".
# !just 3 properties are required!
function Sort-RakumoCSV {
  param(
    [object[]]$List
  )
  $PropertyNames = Import-Csv $sortPropertyFile -Encoding Default
  $p1 = $PropertyNames[0]."Properties for Sort"
  $p2 = $PropertyNames[1]."Properties for Sort"
  $p3 = $PropertyNames[2]."Properties for Sort"
  #$NewList = $List | Sort-Object $p1
  #$NewList = $List | Sort-Object $p1,$p2
  $NewList = $List | Sort-Object $p1,$p2,$p3
  #$NewList = $List | Sort-Object @{Expression=$p1;Descending=$true}, @{Expression=$p2;Descending=$false}, @{Expression=$p3;Descending=$false}
  return $NewList
}

function Expand-GroupEmail {
  param(
    [Parameter(ValueFromPipeline = $true,Mandatory = $true)]
    [object[]]
    $Users
  )
  begin {
#2018/9/27 グループの情報を取得する場合、以下の修正が必要
#2020/04/03 CSVDEで出力したグループ情報ファイルをunicodeで取り込む用に変更
     $groups = Import-Csv $groupFile -Encoding UTF8 | Select-Object DN,mail,CN
     $item_JTC = Import-Csv $JobTitleCodePropertyFile -Encoding Default
     $item_groupmail = Import-Csv $JTCGroupMailPropertyFile -Encoding Default
  } process {  
    foreach ($u in $Users) {
      $memberOf = $u.memberOf -split ";";
      foreach ($groupDN in $memberOf) {
        $rowData = $u.PsObject.Copy()

        # email:
        $wo_result = $false
        foreach ($g in $groups) {
            if ($g.DN -eq $groupDN) {
                $wo_result = $g
                break
            }
        }
        if ($wo_result) {
          $group = $($wo_result)[0]
        } else {
          continue
        }

        if ($group.mail -eq "") {
          #Write-Host $group.DN
          #Write-Warning "group's mail is empty"
        }
#2018/9/27 グループの情報を取得する場合、以下の修正が必要
        $rowData | Add-Member -MemberType NoteProperty -Name "groupMail" -Value $group.mail.ToLower()
        $rowData | Add-Member -MemberType NoteProperty -Name "groupCN" -Value $group.CN

        $array = @()
        # adding job title code column
        # グループアドレスに紐づくJob Title Codeのみを追加する
        for ($i=0; $i -lt $item_JTC.JTC_items.Count; $i++) {
            $JTC_component = $item_JTC.JTC_items[$i]
            $groupmail_component = $item_groupmail.JTC_groupmail_items[$i]
            if ($rowData."groupMail".ToLower() -eq $rowData.$groupmail_component) {
                $rowData_copy = $rowData.PsObject.Copy()
                $rowData_copy | Add-Member -MemberType NoteProperty -Name "Job Title Code" -Value $rowData.$JTC_component 
                #$rowData_copy | Add-Member -MemberType NoteProperty -Name "Job Title" -Value $rowData.$JTC_component
                $array += $rowData_copy 
            }
        }

        # adding primary column: (上部コメントアウト部分はゼロ埋め)
        if($array){
          $number = 0
          foreach($a in $array){
            $primary = if (($rowData."mail".ToLower().Equals($rowData."groupMail")) -and ($number -eq 0)) { 1 } else { 0 }
            $a | Add-Member -MemberType NoteProperty -Name "Primary" -Value $primary
            Write-Output $a
            $number++
          }
        }else{
          $primary = if ($rowData."mail".ToLower().Equals($rowData."groupMail")) { 1 } else { 0 }
          $rowData | Add-Member -MemberType NoteProperty -Name "Primary" -Value $primary
          Write-Output $rowData
        }
      }
      #create only job title code column
      #グループに紐づかないJob Title Codeを追加する
      #Primaryはゼロ埋めとする
      for ($i=0; $i -lt $item_JTC.JTC_items.Count; $i++) {
        $JTC_component = $item_JTC.JTC_items[$i]
        $groupmail_component = $item_groupmail.JTC_groupmail_items[$i]
        if( (($rowData.$groupmail_component -eq "") -or ($rowData.$groupmail_component -eq $null)) -and ($rowData.$JTC_component)){
            $rowData = $u.PsObject.Copy()
            $rowData | Add-Member -MemberType NoteProperty -Name "Job Title Code" -Value $rowData.$JTC_component
            #$rowData | Add-Member -MemberType NoteProperty -Name "Job Title" -Value $rowData.$JTC_component
            $primary = 0
            $rowData | Add-Member -MemberType NoteProperty -Name "Primary" -Value $primary
            Write-Output $rowData
        }
      }
    }
  }
  end {}
}

function Validate-Properties {
  param(
    [Object[]] $List,
    [string] $Property
  )
  foreach($record in $List) {
    if ($record.$Property -eq "") {
      #throw ">> group mail and user mail are empty"
      .\sendMail.ps1 1
      Write-Host($record)
      break
    }
  }
}

function add-string {
  param(
    [Object[]] $ObjectList,
    [string] $Property,
    [string] $Addflg,
    [string] $Addvalue
  )

  #department emailに文字列を追加
  switch ($Addflg.Trim()) {
    1 {
      foreach($deptmail in $ObjectList) {
        $deptmail.$Property = $Addvalue + $deptmail.$Property
      }
    }
    2 {
      foreach($deptmail in $ObjectList) {
        $localpart = $deptmail.$Property.split("@",2)[0]
        $domainpart = $deptmail.$Property.split("@",2)[1]
        $deptmail.$Property = $localpart + $Addvalue + "@" + $domainpart
      }
    }
    Default { break }
  }
}

# main process
# check the result of csvde command
if (.\csvcheck.ps1 $userFile $groupFile) {
  # rakumo-property formatter
  $rakumo2ad = Import-Csv $rakumo2adFile -Delimiter "`t" -Header ad,rakumo | ForEach-Object {
    @{
      Name = $_.rakumo
      Expression = [scriptblock]::Create(('$_.''{0}''' -f $_.ad))
    }
  }

# add columns rakumo2ad.config don't has.
$rakumo2ad += "Primary"
$rakumo2ad += "Job Title Code"
#$rakumo2ad += "Job Title"

# to rakumo-property format.
# 2020/04/03 CSVDEで出力したユーザー情報ファイルをunicodeで取り込むように変更
$newUsers = import-CSV $userFile -Encoding UTF8 | Expand-GroupEmail | Check-Error | Select-Object -Property $rakumo2ad

# sorting.
$newUsers = Sort-RakumoCSV ($newUsers)

# validation check.
Validate-Properties -List $newUsers -Property "User ID"
Validate-Properties -List $newUsers -Property "Department Email"

# add prefix-saffix
$addconfig = Get-Content -Path $addstringFile
$list = @{}
foreach ($line in $addconfig) {
    if ($line -match "addflg =") {
      $addflg = $line.split("=",2)[1]
      $addflg = $addflg.Trim()
    }elseif ($line -match "val =") {
      $addval = $line.split("=",2)[1]
      $addval = $addval.Trim()
      $addval = $addval.Replace('"','')
    }
}

add-string -ObjectList $newUsers -Property "Department Email" -Addflg $addflg -AddValue $addval

# output.
# 2020/04/03 ユーザー詳細CSVファイルをUTF8で作成
$newUsers | Export-Csv $newUserFile -Encoding UTF8 -notype
}
