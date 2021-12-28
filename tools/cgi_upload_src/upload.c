#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include "qdecoder.h"

#define BASEPATH "../upload"

int main(void)
{
    qentry_t *req = qcgireq_parse(NULL, 0);
    int pos = req->getint(req, "pos"); // 0 if not specified
    //int total = req->getint(req, "total");
    const char *filedata = req->getstr(req, "file", false);
    int filelength = req->getint(req, "file.length");
    const char *filename = req->getstr(req, "file.filename", false);
    
    printf("Access-Control-Allow-Origin: *\n");
    qcgires_setcontenttype(req, "application/json");
    
    //fprintf(stderr, "filename: %s, pos %d\n", filename, pos);
    if (filename == NULL || filelength == 0) {
        printf("{\"status\": \"err: filename or length empty\"}\n");
        return 0;
    }
    if (strstr(filename, "/") != NULL) {
        printf("{\"status\": \"err: filename illegal\"}\n");
        return 0;
    }

    char filepath[1024];
    sprintf(filepath, "%s/%s", BASEPATH, filename);

#if 0
    FILE *f_out = fopen(filepath, pos ? "ab" : "wb");
    fwrite(filedata, filelength, 1, f_out);
#else
    FILE *f_out = fopen(filepath, pos == 0 ? "wb" : "r+b");
    fseek(f_out, pos, SEEK_SET);
    int ret = (int) fwrite(filedata, filelength, 1, f_out);
#endif
    fclose(f_out);

    //fprintf(stderr, "ret %d\n", ret);
    if (ret == 1)
        printf("{\"status\": \"ok\"}\n");
    else
        printf("{\"status\": \"err: write error %d\"}\n", errno);
    req->free(req);
    //system("sync &");
    //fprintf(stderr, "return ok\n");
    return 0;
}
