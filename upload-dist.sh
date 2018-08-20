cp -r dist video
gsutil rsync -d -r video gs://install-versions.risevision.com/widgets/video
gsutil -m acl -r ch -u AllUsers:R gs://install-versions.risevision.com/widgets/video
gsutil -m setmeta -r -h Cache-Control:private,max-age=0 gs://install-versions.risevision.com/widgets/video
