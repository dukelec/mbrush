#include <fcntl.h>
#include <poll.h>
#include <mntent.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char * argv[])
{
    char           readbuf[128];
    int            attr_fd = -1;
    struct pollfd  pfd;
    int            retval = 0;
    ssize_t        read_bytes;

    if (argc < 2) {
        fprintf(stderr, "Specify sysfs attr\n");
        exit(1);
    }
    attr_fd = open(argv[1], O_RDONLY, 0);
    if (attr_fd < 0) {
        perror(argv[1]);
        exit(2);
    }

    printf("ready\n");
    pfd.fd = attr_fd;
    pfd.events = POLLERR | POLLPRI;
    pfd.revents = 0;
    while ((retval = poll(&pfd, 1, 100)) >= 0) {
        if (pfd.revents & (POLLERR | POLLPRI)) {
            pfd.revents = 0;

            lseek(attr_fd, 0, SEEK_SET);
            read_bytes = read(attr_fd, readbuf, sizeof(readbuf));
            if (read_bytes < 0) {
                perror(argv[1]);
                printf("error...\n");
                exit(4);
            }
            printf("%.*s\n", (int)read_bytes, readbuf);
        }
    }
    return 0;
}
