# SSH Recovery Guide - Finding Your Files

## Step 1: Check Where You Are

```bash
# What user are you logged in as?
whoami

# What directory are you in?
pwd

# What's in the current directory?
ls -la
```

## Step 2: Find The Graph Files

Since the GUI is still working, the files are definitely there. Let's find them:

```bash
# Find the subgraph directory
find / -name "ethereum-basic-event-handlers" 2>/dev/null

# Or search for graph-node
ps aux | grep graph

# Or check common locations
ls -la ~/
ls -la /root/
ls -la /home/
```

## Step 3: Check Running Processes

The Graph is still running, so let's see what's active:

```bash
# Check if graph-node is running
ps aux | grep graph-node

# Check Docker containers (if using Docker)
docker ps

# Check what's using the ports
netstat -tulpn | grep 8000
netstat -tulpn | grep 8020
```

## Step 4: Navigate to Subgraph Directory

Once you find the path from Step 2, navigate there:

```bash
cd /path/to/subgraph  # Replace with actual path found above
ls -la                # Confirm files are there
```

## Common Locations to Check

```bash
# If installed as root
ls -la /root/graph-node/
ls -la /root/subgraph/

# If installed in home directory
ls -la ~/graph-node/
ls -la ~/subgraph/

# If installed in /opt
ls -la /opt/graph-node/
ls -la /opt/subgraph/

# If installed in /var
ls -la /var/lib/graph-node/
```

## Still Can't Find It?

Check the Graph Node logs to see where it's reading from:

```bash
# If using Docker
docker logs graph-node

# If running as service
journalctl -u graph-node -n 100

# Check systemd services
systemctl status graph-node
```

## Recovery Steps After Finding Files

1. Navigate to the subgraph directory
2. Check if your new files were copied:
   ```bash
   ls -la schema.graphql
   ls -la subgraph.yaml
   ls -la src/mapping.ts
   ```

3. If files are partially uploaded, you may need to re-upload them

4. Continue with the deployment steps
