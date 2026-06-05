csvde -u -f .\src\users.csv -r "(&(objectClass=user)(!userAccountControl:1.2.840.113556.1.4.803:=2))" -d "OU=rakumo,DC=ad,DC=gigei,DC=jp"
